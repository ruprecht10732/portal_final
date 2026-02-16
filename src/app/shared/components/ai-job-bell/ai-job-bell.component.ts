import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { ButtonComponent } from '../button/button.component';
import { AIJobService } from '../../../core/services/ai-job.service';

@Component({
  selector: 'app-ai-job-bell',
  imports: [ButtonComponent, LucideAngularModule],
  templateUrl: './ai-job-bell.component.html',
  styleUrl: './ai-job-bell.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AIJobBellComponent {
  private readonly aiJobs = inject(AIJobService);
  private readonly router = inject(Router);

  protected readonly isOpen = signal(false);
  protected readonly activeCount = this.aiJobs.activeCount;
  protected readonly jobs = this.aiJobs.activeJobs;

  protected toggle(): void {
    this.isOpen.update(v => !v);
  }

  protected close(): void {
    this.isOpen.set(false);
  }

  protected viewJob(jobId?: string, quoteId?: string): void {
    if (!jobId && !quoteId) return;
    if (quoteId) {
      this.router.navigate(['/app/offertes', quoteId]);
      this.close();
      return;
    }
    this.close();
  }
}
