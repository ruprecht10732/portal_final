import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AIJobService } from '../../../core/services/ai-job.service';
import { NotificationSidebarStateService } from '../../../core/services/notification-sidebar-state.service';
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
  protected readonly jobs = this.aiJobs.activeJobs;

  protected close(): void {
    this.sidebarState.close();
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
