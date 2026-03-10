import { DestroyRef, inject, Injectable, NgZone } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { SSEEvent, SSEService } from './sse.service';

@Injectable({ providedIn: 'root' })
export class BrowserNotificationService {
  private readonly sse = inject(SSEService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly zone = inject(NgZone);
  private readonly promptDismissedKey = 'notifications_prompt_dismissed';

  init(): void {
    if (!this.isNotificationApiAvailable()) {
      return;
    }

    this.sse.events
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(event => this.handleEvent(event));
  }

  get canPrompt(): boolean {
    if (!this.isNotificationApiAvailable()) {
      return false;
    }

    return Notification.permission === 'default' && globalThis.localStorage.getItem(this.promptDismissedKey) !== 'true';
  }

  markDismissed(): void {
    if (!this.isBrowserEnvironment()) {
      return;
    }

    globalThis.localStorage.setItem(this.promptDismissedKey, 'true');
  }

  async requestPermission(): Promise<boolean> {
    if (!this.isNotificationApiAvailable()) {
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  private handleEvent(event: SSEEvent): void {
    if (typeof document === 'undefined' || document.hidden === false || Notification.permission !== 'granted') {
      return;
    }

    const notificationDetails = this.buildNotificationDetails(event);
    if (!notificationDetails) {
      return;
    }

    this.showNotification(notificationDetails.title, {
      body: notificationDetails.body,
      icon: '/favicon.ico',
      data: { url: notificationDetails.urlToOpen },
    });
  }

  private showNotification(title: string, options: NotificationOptions): void {
    if (!this.isBrowserEnvironment()) {
      return;
    }

    const notification = new Notification(title, options);

    notification.onclick = event => {
      event.preventDefault();
      globalThis.window.focus();
      notification.close();

      const data = options.data as { url?: string[] | null } | undefined;
      const rawUrl = data?.url;
      if (!rawUrl || !Array.isArray(rawUrl)) {
        return;
      }

      this.zone.run(() => {
        void this.router.navigate(rawUrl);
      });
    };
  }

  private buildNotificationDetails(event: SSEEvent): { title: string; body: string; urlToOpen: string[] | null } | null {
    switch (event.type) {
      case 'whatsapp_message_received':
        return {
          title: 'Nieuw WhatsApp bericht',
          body: this.readStringValue(event.data?.['body']) ?? 'Je hebt een nieuw bericht ontvangen.',
          urlToOpen: ['/app/whatsapp/inbox'],
        };

      case 'quote_accepted': {
        const signatureName = this.readNestedString(event.data?.['payload'], 'signatureName');
        const quoteId = this.readStringValue(event.data?.['quoteId']);
        return {
          title: 'Offerte geaccepteerd!',
          body: `Offerte is zojuist geaccepteerd door ${signatureName ?? 'de klant'}.`,
          urlToOpen: quoteId ? ['/app/offertes', quoteId] : null,
        };
      }

      case 'in_app_notification': {
        const resourceType = this.readStringValue(event.data?.['resourceType']);
        const resourceId = this.readStringValue(event.data?.['resourceId']);
        let urlToOpen: string[] | null = null;
        if (resourceType === 'lead' && resourceId) {
          urlToOpen = ['/app/leads', resourceId];
        } else if (resourceType === 'quote' && resourceId) {
          urlToOpen = ['/app/offertes', resourceId];
        }

        return {
          title: this.readStringValue(event.data?.['title']) ?? 'Nieuwe notificatie',
          body: this.readStringValue(event.data?.['content']) ?? event.message ?? '',
          urlToOpen,
        };
      }

      case 'photo_analysis_complete': {
        if (event.data?.['success'] !== true) {
          return null;
        }

        const leadId = this.readNestedString(event.data?.['analysis'], 'leadId');
        return {
          title: 'AI foto-analyse voltooid',
          body: 'De AI heeft zojuist nieuwe foto\'s geanalyseerd.',
          urlToOpen: leadId ? ['/app/leads', leadId] : null,
        };
      }

      default:
        return null;
    }
  }

  private isBrowserEnvironment(): boolean {
    return globalThis.window !== undefined;
  }

  private isNotificationApiAvailable(): boolean {
    return this.isBrowserEnvironment() && 'Notification' in globalThis.window;
  }

  private readStringValue(value: unknown): string | null {
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }

    if (typeof value === 'number') {
      return String(value);
    }

    return null;
  }

  private readNestedString(value: unknown, key: string): string | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    return this.readStringValue((value as Record<string, unknown>)[key]);
  }
}