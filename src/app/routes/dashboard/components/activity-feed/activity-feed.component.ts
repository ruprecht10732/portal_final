import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { DashboardActivityService } from '../../../../core/services/dashboard-activity.service';
import type { ActivityCategory, ActivityEvent } from '../../../../core/services/dashboard-activity.types';
import { CardComponent } from '../../../../shared/components/card/card.component';

@Component({
  selector: 'app-dashboard-activity-feed',
  templateUrl: './activity-feed.component.html',
  styleUrl: './activity-feed.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent, RouterLink, TranslatePipe],
})
export class ActivityFeedComponent {
  protected readonly activityService = inject(DashboardActivityService);

  protected readonly categories: { key: ActivityCategory; label: string; icon: string }[] = [
    { key: 'leads', label: 'Leads', icon: '👤' },
    { key: 'quotes', label: 'Offertes', icon: '📄' },
    { key: 'appointments', label: 'Afspraken', icon: '📅' },
    { key: 'ai', label: 'AI', icon: '🤖' },
  ];

  protected isFilterActive(category: ActivityCategory): boolean {
    const filters = this.activityService.filters();
    return filters.size === 0 || filters.has(category);
  }

  protected toggleFilter(category: ActivityCategory): void {
    this.activityService.toggleFilter(category);
  }

  protected relativeTime(timestamp: string): string {
    const diff = Date.now() - new Date(timestamp).getTime();
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return 'Nu';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m geleden`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}u geleden`;
    const days = Math.floor(hours / 24);
    return `${days}d geleden`;
  }

  protected categoryIcon(event: ActivityEvent): string {
    switch (event.category) {
      case 'leads':
        return '👤';
      case 'quotes':
        return '📄';
      case 'appointments':
        return '📅';
      case 'ai':
        return '🤖';
    }
  }

  protected categoryColor(event: ActivityEvent): string {
    switch (event.category) {
      case 'leads':
        return 'bg-blue-500';
      case 'quotes':
        return 'bg-indigo-500';
      case 'appointments':
        return 'bg-emerald-500';
      case 'ai':
        return 'bg-violet-500';
    }
  }
}
