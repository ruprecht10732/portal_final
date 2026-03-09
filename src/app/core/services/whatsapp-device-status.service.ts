import { Injectable, computed, inject, signal } from '@angular/core';
import { EMPTY, Subscription, catchError, take } from 'rxjs';
import { OrganizationService, type WhatsAppStatus } from './organization.service';
import type { WhatsAppPresenceType } from './whatsapp-inbox.types';

@Injectable({ providedIn: 'root' })
export class WhatsAppDeviceStatusService {
  private readonly organizationService = inject(OrganizationService);

  private pollingSubscription: Subscription | null = null;

  readonly status = signal<WhatsAppStatus | null>(null);
  readonly canSend = computed(() => this.status()?.canSend ?? true);
  readonly needsReconnectBanner = computed(() => {
    const currentStatus = this.status();
    if (!currentStatus) {
      return false;
    }

    return currentStatus.needsReauth || currentStatus.state.trim().toUpperCase() === 'ERROR';
  });
  readonly needsDeviceConnection = computed(() => {
    const currentStatus = this.status();
    return !!currentStatus && !currentStatus.canSend;
  });
  readonly currentPresence = computed<WhatsAppPresenceType>(() => this.status()?.presence === 'unavailable' ? 'unavailable' : 'available');

  startPolling(intervalMs = 30000): void {
    if (this.pollingSubscription) {
      return;
    }

    this.refresh();
    this.pollingSubscription = new Subscription();
    const timerId = globalThis.setInterval(() => this.refresh(), intervalMs);
    this.pollingSubscription.add(() => globalThis.clearInterval(timerId));
  }

  refresh(): void {
    this.organizationService.getWhatsAppStatus()
      .pipe(
        take(1),
        catchError(() => EMPTY),
      )
      .subscribe((status) => {
        this.status.set(status);
      });
  }
}