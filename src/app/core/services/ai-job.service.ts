import { DestroyRef, computed, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, map, Observable, tap, throwError } from 'rxjs';
import type { GenerateQuoteJobResponse, GenerateQuoteJobStatus } from './quotes.types';
import { QuotesService } from './quotes.service';
import { SSEService } from './sse.service';
import { ToastService } from './toast.service';

export interface AIJobState {
  jobId: string;
  status: GenerateQuoteJobStatus;
  step: string;
  progressPercent: number;
  error?: string;
  quoteId?: string;
  quoteNumber?: string;
  itemCount?: number;
  leadId: string;
  leadServiceId: string;
  startedAt: string;
  updatedAt: string;
  finishedAt?: string;
}

@Injectable({ providedIn: 'root' })
export class AIJobService {
  private readonly quotesService = inject(QuotesService);
  private readonly sse = inject(SSEService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly trackedStorageKey = 'ai_job_tracked_ids';
  private readonly basePollMs = 5000;
  private readonly maxPollMs = 60000;

  private readonly jobsState = signal<Record<string, AIJobState>>({});
  private readonly trackedJobIds = signal<string[]>([]);
  private readonly loadingState = signal(false);
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private pollDelayMs = this.basePollMs;
  private visibilityListener: (() => void) | null = null;

  readonly jobs = computed(() => Object.values(this.jobsState()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
  readonly activeJobs = computed(() => this.jobs().filter(job => job.status === 'pending' || job.status === 'running'));
  readonly activeCount = computed(() => this.activeJobs().length);
  readonly loading = this.loadingState.asReadonly();

  constructor() {
    this.sse.events
      .pipe(takeUntilDestroyed())
      .subscribe(event => {
        if (event.type !== 'ai_job_progress') return;
        const payload = event.data?.['job'];
        if (!payload || typeof payload !== 'object') return;

        const maybeJob = this.normalizeSSEJob(payload as Record<string, unknown>);
        if (!maybeJob) {
          return;
        }

        this.upsertJob({
          jobId: maybeJob.jobId,
          status: maybeJob.status,
          step: maybeJob.step ?? '',
          progressPercent: maybeJob.progressPercent ?? 0,
          ...(maybeJob.error ? { error: maybeJob.error } : {}),
          ...(maybeJob.quoteId ? { quoteId: maybeJob.quoteId } : {}),
          ...(maybeJob.quoteNumber ? { quoteNumber: maybeJob.quoteNumber } : {}),
          ...(typeof maybeJob.itemCount === 'number' ? { itemCount: maybeJob.itemCount } : {}),
          leadId: maybeJob.leadId,
          leadServiceId: maybeJob.leadServiceId,
          startedAt: maybeJob.startedAt,
          updatedAt: maybeJob.updatedAt,
          ...(maybeJob.finishedAt ? { finishedAt: maybeJob.finishedAt } : {}),
        });
      });

    this.restoreTrackedJobs();
    this.bindVisibilityReconcile();
    this.startPollingLoop();

    this.destroyRef.onDestroy(() => {
      if (this.pollTimer) {
        clearTimeout(this.pollTimer);
        this.pollTimer = null;
      }

      if (this.visibilityListener && globalThis.document) {
        globalThis.document.removeEventListener('visibilitychange', this.visibilityListener);
      }
      this.visibilityListener = null;
    });
  }

  /** Load the most recent jobs from the server (cross-device persistence). */
  loadJobs(page = 1, limit = 20): void {
    this.loadingState.set(true);
    this.quotesService.listGenerateJobs({ page, limit }).subscribe({
      next: response => {
        const byId: Record<string, AIJobState> = {};
        for (const item of response.items) {
          byId[item.jobId] = this.mapJob(item);
        }

        // Merge with any in-flight jobs state (SSE updates, local tracked polling) to avoid regressions.
        this.jobsState.update(current => ({
          ...current,
          ...byId,
        }));

        this.loadingState.set(false);
      },
      error: () => {
        this.loadingState.set(false);
      },
    });
  }

  delete(jobId: string): Observable<void> {
    const target = this.jobsState()[jobId];
    if (!target) {
      return new Observable<void>(subscriber => {
        subscriber.next();
        subscriber.complete();
      });
    }

    return this.quotesService.deleteGenerateJob(jobId).pipe(
      tap(() => {
        this.jobsState.update(current => {
          const { [jobId]: _, ...rest } = current;
          return rest;
        });
        this.removeTrackedJob(jobId);
      }),
      catchError(error => {
        this.toast.error('Kon AI taak niet verwijderen');
        return throwError(() => error);
      }),
      map(() => undefined),
    );
  }

  cancel(jobId: string): Observable<void> {
    const target = this.jobsState()[jobId];
    if (!target) {
      return new Observable<void>(subscriber => {
        subscriber.next();
        subscriber.complete();
      });
    }

    return this.quotesService.cancelGenerateJob(jobId).pipe(
      tap(job => {
        this.upsertJob(this.mapJob(job));
      }),
      catchError(error => {
        this.toast.error('Kon AI taak niet annuleren');
        return throwError(() => error);
      }),
      map(() => undefined),
    );
  }

  clearCompleted(): Observable<void> {
    return this.quotesService.clearCompletedGenerateJobs().pipe(
      tap(() => {
        this.jobsState.update(current => {
          const next: Record<string, AIJobState> = {};
          for (const [id, job] of Object.entries(current)) {
            if (job.status !== 'completed' && job.status !== 'cancelled') {
              next[id] = job;
            }
          }
          return next;
        });
      }),
      catchError(error => {
        this.toast.error('Kon voltooide AI taken niet wissen');
        return throwError(() => error);
      }),
      map(() => undefined),
    );
  }

  job(jobId: string | null): AIJobState | null {
    if (!jobId) return null;
    return this.jobsState()[jobId] ?? null;
  }

  track(jobId: string): void {
    this.addTrackedJob(jobId);
    this.fetchJob(jobId);
  }

  private upsertJob(job: AIJobState): void {
    this.jobsState.update(current => ({
      ...current,
      [job.jobId]: job,
    }));

    if (this.isActive(job.status)) {
      this.addTrackedJob(job.jobId);
    } else {
      this.removeTrackedJob(job.jobId);
    }
  }

  private fetchJob(jobId: string): void {
    this.quotesService.getGenerateJob(jobId).subscribe({
      next: job => {
        this.upsertJob(this.mapJob(job));
        this.resetPollDelay();
      },
      error: () => {
        this.increasePollDelay();
      },
    });
  }

  private reconcileActiveJobs(): void {
    if (typeof document !== 'undefined' && document.hidden) return;

    const activeIds = this.activeJobs().map(job => job.jobId);
    const ids = Array.from(new Set([...this.trackedJobIds(), ...activeIds]));
    if (ids.length === 0) return;

    for (const jobId of ids) {
      this.fetchJob(jobId);
    }
  }

  private startPollingLoop(): void {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
    }

    this.pollTimer = setTimeout(() => {
      this.reconcileActiveJobs();
      this.startPollingLoop();
    }, this.pollDelayMs);
  }

  private bindVisibilityReconcile(): void {
    if (globalThis.window === undefined || globalThis.document === undefined || this.visibilityListener) {
      return;
    }

    this.visibilityListener = () => {
      if (!globalThis.document.hidden) {
        this.reconcileActiveJobs();
        this.startPollingLoop();
      }
    };

    globalThis.document.addEventListener('visibilitychange', this.visibilityListener);
  }

  private restoreTrackedJobs(): void {
    if (globalThis.window === undefined) {
      return;
    }

    let ids: string[] = [];
    try {
      const raw = globalThis.localStorage.getItem(this.trackedStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          ids = parsed.filter((value): value is string => typeof value === 'string' && value.length > 0);
        }
      }
    } catch {
      ids = [];
    }

    this.trackedJobIds.set(ids);
    for (const id of ids) {
      this.fetchJob(id);
    }
  }

  private addTrackedJob(jobId: string): void {
    if (!jobId) return;
    this.trackedJobIds.update(current => {
      if (current.includes(jobId)) return current;
      const next = [...current, jobId];
      this.persistTrackedJobs(next);
      return next;
    });
  }

  private removeTrackedJob(jobId: string): void {
    this.trackedJobIds.update(current => {
      if (!current.includes(jobId)) return current;
      const next = current.filter(id => id !== jobId);
      this.persistTrackedJobs(next);
      return next;
    });
  }

  private persistTrackedJobs(ids: string[]): void {
    if (globalThis.window === undefined) {
      return;
    }

    try {
      globalThis.localStorage.setItem(this.trackedStorageKey, JSON.stringify(ids));
    } catch {
      return;
    }
  }

  private isActive(status: GenerateQuoteJobStatus): boolean {
    return status === 'pending' || status === 'running';
  }

  private resetPollDelay(): void {
    this.pollDelayMs = this.basePollMs;
  }

  private increasePollDelay(): void {
    this.pollDelayMs = Math.min(this.pollDelayMs * 2, this.maxPollMs);
  }

  private mapJob(job: GenerateQuoteJobResponse): AIJobState {
    return {
      jobId: job.jobId,
      status: job.status,
      step: job.step,
      progressPercent: job.progressPercent,
      ...(job.error ? { error: job.error } : {}),
      ...(job.quoteId ? { quoteId: job.quoteId } : {}),
      ...(job.quoteNumber ? { quoteNumber: job.quoteNumber } : {}),
      ...(typeof job.itemCount === 'number' ? { itemCount: job.itemCount } : {}),
      leadId: job.leadId,
      leadServiceId: job.leadServiceId,
      startedAt: job.startedAt,
      updatedAt: job.updatedAt,
      ...(job.finishedAt ? { finishedAt: job.finishedAt } : {}),
    };
  }

  private normalizeSSEJob(source: Record<string, unknown>): AIJobState | null {
    const readString = (camel: string, snake: string): string | undefined => {
      const camelValue = source[camel];
      if (typeof camelValue === 'string' && camelValue.length > 0) return camelValue;
      const snakeValue = source[snake];
      if (typeof snakeValue === 'string' && snakeValue.length > 0) return snakeValue;
      return undefined;
    };

    const readNumber = (camel: string, snake: string): number | undefined => {
      const camelValue = source[camel];
      if (typeof camelValue === 'number') return camelValue;
      const snakeValue = source[snake];
      if (typeof snakeValue === 'number') return snakeValue;
      return undefined;
    };

    const status = this.normalizeStatus(readString('status', 'status'));
    const jobId = readString('jobId', 'job_id');
    const leadId = readString('leadId', 'lead_id');
    const leadServiceId = readString('leadServiceId', 'lead_service_id');
    const startedAt = readString('startedAt', 'started_at');
    const updatedAt = readString('updatedAt', 'updated_at');

    if (!status || !jobId || !leadId || !leadServiceId || !startedAt || !updatedAt) {
      return null;
    }

    const error = readString('error', 'error');
    const quoteId = readString('quoteId', 'quote_id');
    const quoteNumber = readString('quoteNumber', 'quote_number');
    const itemCount = readNumber('itemCount', 'item_count');
    const finishedAt = readString('finishedAt', 'finished_at');

    return {
      jobId,
      status,
      step: readString('step', 'step') ?? '',
      progressPercent: readNumber('progressPercent', 'progress_percent') ?? 0,
      ...(error ? { error } : {}),
      ...(quoteId ? { quoteId } : {}),
      ...(quoteNumber ? { quoteNumber } : {}),
      ...(typeof itemCount === 'number' ? { itemCount } : {}),
      leadId,
      leadServiceId,
      startedAt,
      updatedAt,
      ...(finishedAt ? { finishedAt } : {}),
    };
  }

  private normalizeStatus(value: string | undefined): GenerateQuoteJobStatus | null {
    switch (value) {
      case 'pending':
      case 'running':
      case 'completed':
      case 'failed':
      case 'cancelled':
        return value;
      default:
        return null;
    }
  }
}
