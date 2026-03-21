import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { finalize } from 'rxjs';
import { AIJobService } from '../../../core/services/ai-job.service';
import { NotificationSidebarStateService } from '../../../core/services/notification-sidebar-state.service';
import type { AIJobState } from '../../../core/services/ai-job.service';
import { ButtonComponent } from '../button/button.component';
import { RightSidebarComponent } from '../right-sidebar/right-sidebar.component';

@Component({
  selector: 'app-ai-job-sidebar-panel',
  imports: [ButtonComponent, LucideAngularModule, RightSidebarComponent, TranslatePipe],
  templateUrl: './ai-job-sidebar-panel.component.html',
  styleUrl: './ai-job-sidebar-panel.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AIJobSidebarPanelComponent {
  private readonly aiJobs = inject(AIJobService);
  private readonly sidebarState = inject(NotificationSidebarStateService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  protected readonly isOpen = this.sidebarState.isAiJobsOpen;
  protected readonly jobs = this.aiJobs.jobs;
  protected readonly loading = this.aiJobs.loading;
  protected readonly hasCompleted = computed(() => this.jobs().some(job => job.status === 'completed'));
  protected readonly cancellingJobId = signal<string | null>(null);
  protected readonly feedbackJobId = signal<string | null>(null);
  protected readonly unviewedJobIds = computed(() => new Set(this.jobs().filter(job => !job.viewedAt && this.isTerminal(job)).map(job => job.jobId)));

  constructor() {
    effect(() => {
      if (!this.isOpen()) {
        return;
      }

      this.aiJobs.loadJobs(1, 20);
    });
  }

  protected close(): void {
    this.sidebarState.close();
  }

  protected onDeleteJob(event: MouseEvent, job: AIJobState): void {
    event.stopPropagation();

    if (job.status !== 'completed' && job.status !== 'failed' && job.status !== 'cancelled') {
      return;
    }

    this.aiJobs.delete(job.jobId).subscribe();
  }

  protected onCancelJob(event: MouseEvent, job: AIJobState): void {
    event.stopPropagation();

    if (!this.canCancel(job)) {
      return;
    }

    const reason = globalThis.window?.prompt(this.translate.instant('aiJobs.cancelPrompt'))?.trim();
    this.cancellingJobId.set(job.jobId);
    this.aiJobs.cancel(job.jobId, reason).pipe(
      finalize(() => this.cancellingJobId.set(null)),
    ).subscribe();
  }

  protected onSubmitFeedback(event: MouseEvent, job: AIJobState, rating: -1 | 1): void {
    event.stopPropagation();

    if (!this.canSubmitFeedback(job)) {
      return;
    }

    const promptLabel = rating === 1 ? this.translate.instant('aiJobs.feedbackPositivePrompt') : this.translate.instant('aiJobs.feedbackNegativePrompt');
    const comment = globalThis.window?.prompt(promptLabel, job.feedbackComment ?? '')?.trim();
    this.feedbackJobId.set(job.jobId);
    this.aiJobs.submitFeedback(job.jobId, rating, comment).pipe(
      finalize(() => this.feedbackJobId.set(null)),
    ).subscribe();
  }

  protected onClearCompleted(): void {
    this.aiJobs.clearCompleted().subscribe();
  }

  protected viewJob(job: AIJobState): void {
    if (job.jobId) {
      this.aiJobs.markViewed(job.jobId).subscribe();
    }

    if (job.quoteId) {
      void this.router.navigate(['/app/offertes', job.quoteId]);
      this.close();
      return;
    }

    this.close();
  }

  protected isTerminal(job: AIJobState): boolean {
    return job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled';
  }

  protected jobLabel(job: AIJobState): string {
	if (job.kind === 'lead_analysis') {
	  return this.translate.instant('aiJobs.kind.leadAnalysis');
	}
	if (job.kind === 'photo_analysis') {
	  return this.translate.instant('aiJobs.kind.photoAnalysis');
	}
	if (job.kind === 'subsidy_analysis') {
	  return this.translate.instant('aiJobs.kind.subsidyAnalysis');
	}
	return this.translate.instant('aiJobs.kind.quoteGeneration');
  }

  protected canCancel(job: AIJobState): boolean {
	return job.kind === 'quote_generation' && (job.status === 'pending' || job.status === 'running');
  }

  protected canSubmitFeedback(job: AIJobState): boolean {
	return job.kind === 'quote_generation' && (job.status === 'completed' || job.status === 'failed');
  }
}
