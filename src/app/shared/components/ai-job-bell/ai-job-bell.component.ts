import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { ButtonComponent } from '../button/button.component';
import { AIJobService } from '../../../core/services/ai-job.service';
import { NotificationSidebarStateService } from '../../../core/services/notification-sidebar-state.service';

@Component({
  selector: 'app-ai-job-bell',
  imports: [ButtonComponent, LucideAngularModule],
  templateUrl: './ai-job-bell.component.html',
  styleUrl: './ai-job-bell.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AIJobBellComponent {
  private readonly aiJobs = inject(AIJobService);
  private readonly sidebarState = inject(NotificationSidebarStateService);

  protected readonly isOpen = this.sidebarState.isAiJobsOpen;
  protected readonly activeCount = this.aiJobs.activeCount;

  protected toggle(): void {
    this.sidebarState.toggleAiJobs();
  }
}
