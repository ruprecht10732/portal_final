import { Injectable, computed, signal } from '@angular/core';

type OverlayPanel = 'notifications' | 'ai-jobs' | null;

@Injectable({
  providedIn: 'root',
})
export class NotificationSidebarStateService {
  private readonly _activePanel = signal<OverlayPanel>(null);

  readonly activePanel = this._activePanel.asReadonly();
  readonly isOpen = computed(() => this.activePanel() !== null);
  readonly isNotificationsOpen = computed(() => this.activePanel() === 'notifications');
  readonly isAiJobsOpen = computed(() => this.activePanel() === 'ai-jobs');

  toggleNotifications(): boolean {
    const nextOpen = this.activePanel() !== 'notifications';
    this._activePanel.set(nextOpen ? 'notifications' : null);
    return nextOpen;
  }

  toggleAiJobs(): boolean {
    const nextOpen = this.activePanel() !== 'ai-jobs';
    this._activePanel.set(nextOpen ? 'ai-jobs' : null);
    return nextOpen;
  }

  openNotifications(): void {
    this._activePanel.set('notifications');
  }

  openAiJobs(): void {
    this._activePanel.set('ai-jobs');
  }

  close(): void {
    this._activePanel.set(null);
  }
}
