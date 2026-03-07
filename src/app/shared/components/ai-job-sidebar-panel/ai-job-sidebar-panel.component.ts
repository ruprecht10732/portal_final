import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { finalize } from 'rxjs';
import { AIJobService } from '../../../core/services/ai-job.service';
import { NotificationSidebarStateService } from '../../../core/services/notification-sidebar-state.service';
import type { AIJobState } from '../../../core/services/ai-job.service';
import { ButtonComponent } from '../button/button.component';
import { RightSidebarComponent } from '../right-sidebar/right-sidebar.component';

@Component({
  selector: 'app-ai-job-sidebar-panel',
  imports: [ButtonComponent, LucideAngularModule, RightSidebarComponent],
  templateUrl: './ai-job-sidebar-panel.component.html',
  styleUrl: './ai-job-sidebar-panel.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AIJobSidebarPanelComponent {
  private readonly aiJobs = inject(AIJobService);
  private readonly sidebarState = inject(NotificationSidebarStateService);
  private readonly router = inject(Router);

  protected readonly isOpen = this.sidebarState.isAiJobsOpen;
  protected readonly jobs = this.aiJobs.jobs;
  protected readonly loading = this.aiJobs.loading;
  protected readonly hasCompleted = computed(() => this.jobs().some(job => job.status === 'completed'));
  protected readonly cancellingJobId = signal<string | null>(null);

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

    if (job.status !== 'pending' && job.status !== 'running') {
      return;
    }

    this.cancellingJobId.set(job.jobId);
    this.aiJobs.cancel(job.jobId).pipe(
      finalize(() => this.cancellingJobId.set(null)),
    ).subscribe();
  }

  protected onClearCompleted(): void {
    this.aiJobs.clearCompleted().subscribe();
  }

  protected viewJob(jobId?: string, quoteId?: string): void {
    if (!jobId && !quoteId) {
      return;
    }

    if (quoteId) {
      void this.router.navigate(['/app/offertes', quoteId]);
      this.close();
      return;
    }

    this.close();
  }
}
