import { DestroyRef, computed, effect, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, map, Observable, of, tap, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';
import type { GenerateQuoteJobResponse, GenerateQuoteJobStatus } from './quotes.types';
import type { AutomationRunKind, AutomationRunResponse, LeadAIAnalysisResponse } from './leads.types';
import { LeadsService } from './leads.service';
import { QuotesService } from './quotes.service';
import { SSEService } from './sse.service';
import { ToastService } from './toast.service';

export type AIJobKind = 'quote_generation' | 'subsidy_analysis' | AutomationRunKind;

export interface AIJobState {
  jobId: string;
  kind: AIJobKind;
  status: GenerateQuoteJobStatus;
  step: string;
  progressPercent: number;
  error?: string;
  quoteId?: string;
  quoteNumber?: string;
  itemCount?: number;
  feedbackRating?: -1 | 1;
  feedbackComment?: string;
  feedbackAt?: string;
  cancellationReason?: string;
  viewedAt?: string;
  message?: string;
  leadId: string;
  leadServiceId: string;
  startedAt: string;
  updatedAt: string;
  finishedAt?: string;
}

@Injectable({ providedIn: 'root' })
export class AIJobService {
  private readonly quotesService = inject(QuotesService);
  private readonly leadsService = inject(LeadsService);
  private readonly sse = inject(SSEService);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly trackedStorageKey = 'ai_job_tracked_ids';
  private readonly basePollMs = 5000;
  private readonly maxPollMs = 60000;
  private readonly staleThresholdMs = 5 * 60 * 1000;
  private originalTitle = '';

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
          kind: 'quote_generation',
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

    this.sse.events
      .pipe(takeUntilDestroyed())
      .subscribe(event => {
        if (event.type === 'analysis_complete') {
          this.completeAutomationJob('lead_analysis', event.leadId, event.serviceId);
          return;
        }
      });

    this.sse.events
      .pipe(takeUntilDestroyed())
      .subscribe(event => {
        if (event.type !== 'subsidy_analysis_progress') return;
        const payload = event.data?.['job'];
        if (!payload || typeof payload !== 'object') return;

        const raw = payload as Record<string, unknown>;
        const jobId = typeof raw['jobId'] === 'string' ? raw['jobId'] : undefined;
        const status = this.normalizeStatus(typeof raw['status'] === 'string' ? raw['status'] : undefined);
        if (!jobId || !status) return;

        const existing = this.jobsState()[jobId];
        if (existing?.kind !== 'subsidy_analysis') return;

        this.upsertJob({
          ...existing,
          status,
          step: typeof raw['step'] === 'string' ? raw['step'] : existing.step,
          progressPercent: typeof raw['progressPercent'] === 'number' ? raw['progressPercent'] : existing.progressPercent,
          updatedAt: typeof raw['updatedAt'] === 'string' ? raw['updatedAt'] : new Date().toISOString(),
        });
      });

    this.restoreTrackedJobs();
    this.bindVisibilityReconcile();
    this.startPollingLoop();
    this.requestNotificationPermission();

    if (typeof document !== 'undefined') {
      this.originalTitle = document.title;
    }

    effect(() => {
      const count = this.activeCount();
      if (typeof document === 'undefined') return;
      if (!this.originalTitle) {
        this.originalTitle = document.title.replace(/^\(\d+\)\s/, '');
      }
      document.title = count > 0
        ? this.translate.instant('aiJobs.tabBadge', { count }) + this.originalTitle
        : this.originalTitle;
    });

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
        // Local state takes precedence over server state.
        this.jobsState.update(current => ({
          ...byId,
          ...current,
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
      return of(void 0);
    }

    if (target.kind !== 'quote_generation') {
      this.jobsState.update(current => {
        const { [jobId]: _, ...rest } = current;
        return rest;
      });
      return of(void 0);
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
        this.toast.error(this.translate.instant('aiJobs.errors.delete'));
        return throwError(() => error);
      }),
      map(() => undefined),
    );
  }

  cancel(jobId: string, reason?: string): Observable<void> {
    const target = this.jobsState()[jobId];
    if (target?.kind !== 'quote_generation') {
      return of(void 0);
    }

    return this.quotesService.cancelGenerateJob(jobId, reason).pipe(
      tap(job => {
        this.upsertJob(this.mapJob(job));
      }),
      catchError(error => {
        this.toast.error(this.translate.instant('aiJobs.errors.cancel'));
        return throwError(() => error);
      }),
      map(() => undefined),
    );
  }

  submitFeedback(jobId: string, rating: -1 | 1, comment?: string): Observable<void> {
    const target = this.jobsState()[jobId];
    if (target?.kind !== 'quote_generation') {
      return of(void 0);
    }

    const payload = comment ? { rating, comment } : { rating };
    return this.quotesService.submitGenerateJobFeedback(jobId, payload).pipe(
      tap(job => {
        this.upsertJob(this.mapJob(job));
      }),
      catchError(error => {
        this.toast.error(this.translate.instant('aiJobs.errors.feedback'));
        return throwError(() => error);
      }),
      map(() => undefined),
    );
  }

  markViewed(jobId: string): Observable<void> {
    const target = this.jobsState()[jobId];
    if (!target || target.viewedAt) {
      return of(void 0);
    }

    if (target.kind !== 'quote_generation') {
      this.jobsState.update(current => ({
        ...current,
        [jobId]: {
          ...target,
          viewedAt: new Date().toISOString(),
        },
      }));
      return of(void 0);
    }

    return this.quotesService.markGenerateJobViewed(jobId).pipe(
      tap(job => {
        this.upsertJob(this.mapJob(job));
      }),
      catchError(error => {
        if (error instanceof HttpErrorResponse && error.status === 404) {
          this.jobsState.update(current => ({
            ...current,
            [jobId]: { ...target, viewedAt: new Date().toISOString() },
          }));
          return of(undefined);
        }
        return throwError(() => error);
      }),
      map(() => undefined),
    );
  }

  clearCompleted(): Observable<void> {
    this.jobsState.update(current => {
      const next: Record<string, AIJobState> = {};
      for (const [id, job] of Object.entries(current)) {
        if (job.kind !== 'quote_generation' && (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled')) {
          continue;
        }
        next[id] = job;
      }
      return next;
    });

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
        this.toast.error(this.translate.instant('aiJobs.errors.clearCompleted'));
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
    this.resetPollDelay();
    this.fetchJob(jobId);
  }

  trackAutomationRun(run: AutomationRunResponse): void {
    this.upsertJob(this.mapAutomationRun(run));
  }

  trackSubsidyAnalysisJob(jobId: string, leadId: string, leadServiceId: string): void {
    const now = new Date().toISOString();
    this.upsertJob({
      jobId,
      kind: 'subsidy_analysis',
      status: 'pending',
      step: '',
      progressPercent: 0,
      leadId,
      leadServiceId,
      startedAt: now,
      updatedAt: now,
    });
    this.resetPollDelay();
  }

  private upsertJob(job: AIJobState): void {
    const prev = this.jobsState()[job.jobId];
    const wasActive = prev && this.isActive(prev.status);
    const isNowTerminal = job.status === 'completed' || job.status === 'failed';

    this.jobsState.update(current => ({
      ...current,
      [job.jobId]: job,
    }));

    if (job.kind === 'quote_generation' && this.isActive(job.status)) {
      this.addTrackedJob(job.jobId);
    } else if (job.kind === 'quote_generation') {
      this.removeTrackedJob(job.jobId);
    }

    if (wasActive && isNowTerminal) {
      this.notifyJobCompletion(job);
    }
  }

  private notifyJobCompletion(job: AIJobState): void {
    const kind = this.kindLabel(job.kind);
    const isSuccess = job.status === 'completed';
    const messageKey = isSuccess ? 'aiJobs.toast.completed' : 'aiJobs.toast.failed';
    const message = this.translate.instant(messageKey, { kind });

    const link = isSuccess && job.kind === 'quote_generation' && job.quoteId
      ? { label: this.translate.instant('aiJobs.toast.viewQuote'), url: ['/app/offertes', job.quoteId] as string[] }
      : undefined;

    this.toast.show({
      message,
      variant: isSuccess ? 'success' : 'error',
      ...(link ? { link } : {}),
      durationMs: 8000,
    });

    this.sendBrowserNotification(message);
  }

  private kindLabel(kind: AIJobKind): string {
    switch (kind) {
      case 'quote_generation': return this.translate.instant('aiJobs.kind.quoteGeneration');
      case 'lead_analysis': return this.translate.instant('aiJobs.kind.leadAnalysis');
      case 'subsidy_analysis': return this.translate.instant('aiJobs.kind.subsidyAnalysis');
      default: return kind;
    }
  }

  private requestNotificationPermission(): void {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      void Notification.requestPermission();
    }
  }

  private sendBrowserNotification(body: string): void {
    if (typeof document === 'undefined' || !document.hidden) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    new Notification('Portal', { body, icon: '/favicon.ico' });
  }

  private fetchJob(jobId: string): void {
    this.quotesService.getGenerateJob(jobId).subscribe({
      next: job => {
        this.upsertJob(this.mapJob(job));
        this.resetPollDelay();
      },
      error: (err: unknown) => {
        if (err instanceof HttpErrorResponse && err.status === 404) {
          this.removeTrackedJob(jobId);
          const existing = this.jobsState()[jobId];
          if (existing) {
            this.jobsState.update(current => ({
              ...current,
              [jobId]: { ...existing, status: 'failed', error: 'not_found', finishedAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
            }));
          }
          return;
        }
        this.increasePollDelay();
      },
    });
  }

  private reconcileActiveJobs(): void {
    if (typeof document !== 'undefined' && document.hidden) return;

    const activeJobs = this.activeJobs();
    const quoteIds = Array.from(new Set([...this.trackedJobIds(), ...activeJobs.filter(job => job.kind === 'quote_generation').map(job => job.jobId)]));

    for (const jobId of quoteIds) {
      this.fetchJob(jobId);
    }

    for (const job of activeJobs) {
      if (job.kind === 'lead_analysis') {
        this.fetchLeadAnalysisJob(job);
      } else if (job.kind === 'subsidy_analysis') {
        this.fetchSubsidyAnalysisJob(job);
      }
    }

    this.detectStaleJobs();
  }

  private detectStaleJobs(): void {
    const now = Date.now();
    const staleIds: string[] = [];

    this.jobsState.update(current => {
      let changed = false;
      const next = { ...current };
      for (const [jobId, job] of Object.entries(current)) {
        if (!this.isActive(job.status)) continue;
        const elapsed = now - new Date(job.updatedAt).getTime();
        if (elapsed > this.staleThresholdMs) {
          changed = true;
          staleIds.push(jobId);
          next[jobId] = {
            ...job,
            status: 'failed',
            step: 'stale',
            error: 'stale',
            updatedAt: new Date().toISOString(),
            finishedAt: new Date().toISOString(),
          };
        }
      }
      return changed ? next : current;
    });

    for (const id of staleIds) {
      this.removeTrackedJob(id);
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
        this.resetPollDelay();
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
    const current = this.trackedJobIds();
    if (current.includes(jobId)) return;
    const next = [...current, jobId];
    this.trackedJobIds.set(next);
    this.persistTrackedJobs(next);
  }

  private removeTrackedJob(jobId: string): void {
    const current = this.trackedJobIds();
    if (!current.includes(jobId)) return;
    const next = current.filter(id => id !== jobId);
    this.trackedJobIds.set(next);
    this.persistTrackedJobs(next);
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
      kind: 'quote_generation',
      status: job.status,
      step: job.step,
      progressPercent: job.progressPercent,
      ...(job.error ? { error: job.error } : {}),
      ...(job.quoteId ? { quoteId: job.quoteId } : {}),
      ...(job.quoteNumber ? { quoteNumber: job.quoteNumber } : {}),
      ...(typeof job.itemCount === 'number' ? { itemCount: job.itemCount } : {}),
      ...(job.feedbackRating ? { feedbackRating: job.feedbackRating } : {}),
      ...(job.feedbackComment ? { feedbackComment: job.feedbackComment } : {}),
      ...(job.feedbackAt ? { feedbackAt: job.feedbackAt } : {}),
      ...(job.cancellationReason ? { cancellationReason: job.cancellationReason } : {}),
      ...(job.viewedAt ? { viewedAt: job.viewedAt } : {}),
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
      kind: 'quote_generation',
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

  private mapAutomationRun(run: AutomationRunResponse): AIJobState {
    return {
      jobId: run.jobId,
      kind: run.kind,
      status: run.status,
      step: run.step,
      progressPercent: run.progressPercent,
      ...(run.message ? { message: run.message } : {}),
      leadId: run.leadId,
      leadServiceId: run.leadServiceId,
      startedAt: run.startedAt,
      updatedAt: run.updatedAt,
      ...(run.finishedAt ? { finishedAt: run.finishedAt } : {}),
    };
  }

  private fetchLeadAnalysisJob(job: AIJobState): void {
    this.leadsService.getLatestAnalysis(job.leadId, job.leadServiceId).subscribe({
      next: (response: LeadAIAnalysisResponse) => {
        if (response.analysis && !response.isDefault) {
          this.completeAutomationJob('lead_analysis', job.leadId, job.leadServiceId);
          this.resetPollDelay();
        }
      },
      error: () => {
        this.increasePollDelay();
      },
    });
  }

  private fetchSubsidyAnalysisJob(job: AIJobState): void {
    this.quotesService.getSubsidyAnalysisJob(job.jobId).subscribe({
      next: (response) => {
        const status = this.normalizeStatus(response.status) ?? 'running';
        this.upsertJob({
          ...job,
          status,
          step: response.step ?? job.step,
          progressPercent: response.progressPercent ?? job.progressPercent,
          ...(response.error ? { error: response.error } : {}),
          updatedAt: response.updatedAt ?? job.updatedAt,
          ...(response.startedAt ? { startedAt: response.startedAt } : {}),
          ...(response.finishedAt ? { finishedAt: response.finishedAt } : {}),
        });
        this.resetPollDelay();
      },
      error: () => {
        this.increasePollDelay();
      },
    });
  }

  private completeAutomationJob(kind: AutomationRunKind, leadId?: string, leadServiceId?: string, status: GenerateQuoteJobStatus = 'completed', error?: string): void {
    if (!leadId || !leadServiceId) {
      return;
    }

    const finishedAt = new Date().toISOString();
    this.jobsState.update(current => {
      const next: Record<string, AIJobState> = { ...current };
      for (const [jobId, job] of Object.entries(current)) {
        if (job.kind !== kind || job.leadId !== leadId || job.leadServiceId !== leadServiceId || !this.isActive(job.status)) {
          continue;
        }
        next[jobId] = {
          ...job,
          status,
          step: status === 'failed' ? this.translate.instant('aiJobs.step.failed') : this.translate.instant('aiJobs.step.completed'),
          progressPercent: status === 'failed' ? job.progressPercent : 100,
          updatedAt: finishedAt,
          finishedAt,
          ...(error ? { error } : {}),
        };
      }
      return next;
    });
  }
}
