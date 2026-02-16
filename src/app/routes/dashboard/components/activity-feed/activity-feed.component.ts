import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
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
  private readonly translateService = inject(TranslateService);

  protected readonly categories: { key: ActivityCategory; label: string; icon: string }[] = [
    { key: 'leads', label: 'dashboard.activityFeed.filters.leads', icon: '👤' },
    { key: 'quotes', label: 'dashboard.activityFeed.filters.quotes', icon: '📄' },
    { key: 'appointments', label: 'dashboard.activityFeed.filters.appointments', icon: '📅' },
    { key: 'ai', label: 'dashboard.activityFeed.filters.ai', icon: '🤖' },
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
    const seconds = Math.max(1, Math.floor(diff / 1000));

    if (seconds < 60) {
      return this.translateService.instant('dashboard.activityFeed.now');
    }

    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    const language = this.translateService.currentLang || this.translateService.getDefaultLang() || 'en';
    const locale = language === 'nl' ? 'nl-NL' : 'en-US';
    const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

    if (minutes < 60) {
      return formatter.format(-minutes, 'minute');
    }

    if (hours < 24) {
      return formatter.format(-hours, 'hour');
    }

    return formatter.format(-days, 'day');
  }

  protected categoryLabel(category: ActivityCategory): string {
    const keyMap: Record<ActivityCategory, string> = {
      leads: 'dashboard.activityFeed.filters.leads',
      quotes: 'dashboard.activityFeed.filters.quotes',
      appointments: 'dashboard.activityFeed.filters.appointments',
      ai: 'dashboard.activityFeed.filters.ai',
    };

    return keyMap[category];
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
