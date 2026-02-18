import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { DashboardActivityService } from '../../../../core/services/dashboard-activity.service';
import type { ActivityCategory, ActivityEvent } from '../../../../core/services/dashboard-activity.types';

@Component({
  selector: 'app-dashboard-activity-feed',
  templateUrl: './activity-feed.component.html',
  styleUrl: './activity-feed.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe, LucideAngularModule],
})
export class ActivityFeedComponent {
  protected readonly activityService = inject(DashboardActivityService);
  private readonly translateService = inject(TranslateService);

  protected readonly filteredEvents = this.activityService.filteredEvents;
  protected readonly filteredCount = computed(() => this.filteredEvents().length);

  private readonly rtfCache = new Map<string, Intl.RelativeTimeFormat>();

  protected readonly categories: { key: ActivityCategory; label: string; icon: string }[] = [
    { key: 'leads', label: 'dashboard.activityFeed.filters.leads', icon: 'user' },
    { key: 'quotes', label: 'dashboard.activityFeed.filters.quotes', icon: 'file-text' },
    { key: 'appointments', label: 'dashboard.activityFeed.filters.appointments', icon: 'calendar' },
    { key: 'ai', label: 'dashboard.activityFeed.filters.ai', icon: 'sparkles' },
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
    let formatter = this.rtfCache.get(locale);
    if (!formatter) {
      formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
      this.rtfCache.set(locale, formatter);
    }

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
      case 'leads':        return 'user';
      case 'quotes':       return 'file-text';
      case 'appointments': return 'calendar';
      case 'ai':           return 'sparkles';
    }
  }

  protected categoryColor(event: ActivityEvent): string {
    switch (event.category) {
      case 'leads':        return 'bg-blue-500';
      case 'quotes':       return 'bg-indigo-500';
      case 'appointments': return 'bg-emerald-500';
      case 'ai':           return 'bg-violet-500';
    }
  }

  protected categoryPillActive(key: ActivityCategory): string {
    switch (key) {
      case 'leads':        return 'bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400';
      case 'quotes':       return 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400';
      case 'appointments': return 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400';
      case 'ai':           return 'bg-violet-100 text-violet-600 dark:bg-violet-950/50 dark:text-violet-400';
    }
  }
}
