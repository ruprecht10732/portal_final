import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, finalize, timer } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { WhatsAppAgentDeviceStatus, WhatsAppAgentService, WhatsAppAgentWebhookConfig } from '../../core/services/whatsapp-agent.service';
import { resolveWhatsAppQrError } from '../../core/utils/whatsapp-qr-error.util';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { CardComponent } from '../../shared/components/card/card.component';
import { PageLayoutComponent } from '../../shared/components/page-layout/page-layout.component';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-whatsapp-agent-admin',
  imports: [ButtonComponent, CardComponent, PageLayoutComponent, SkeletonComponent, TranslatePipe],
  templateUrl: './whatsapp-agent-admin.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WhatsAppAgentAdminComponent {
  protected readonly status = signal<WhatsAppAgentDeviceStatus | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly isAction = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly successMessage = signal('');
  protected readonly qrBlobUrl = signal<string | null>(null);
  protected readonly qrMessage = signal('');
  protected readonly qrMessageVariant = signal<'error' | 'info'>('error');
  protected readonly webhookConfig = signal<WhatsAppAgentWebhookConfig | null>(null);
  protected readonly webhookConfigError = signal('');
  protected readonly callbackCopied = signal(false);
  protected readonly secretCopied = signal(false);

  private statusPollingStarted = false;

  private readonly agentService = inject(WhatsAppAgentService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);

  protected readonly isConnected = computed(() => this.status()?.state === 'CONNECTED');
  protected readonly isUnregistered = computed(() => this.status()?.state === 'UNREGISTERED' || !this.status()?.deviceId);
  protected readonly deviceId = computed(() => this.status()?.deviceId?.trim() || '');
  protected readonly accountJid = computed(() => this.status()?.accountJid?.trim() || '');
  protected readonly callbackUrl = computed(() => `${environment.apiBaseUrl}/webhook/whatsapp`);
  protected readonly callbackUrlWithQuery = computed(() => {
    const config = this.webhookConfig();
    if (!config?.sharedSecret) {
      return this.callbackUrl();
    }
    return `${this.callbackUrl()}?${encodeURIComponent(config.queryParamName)}=${encodeURIComponent(config.sharedSecret)}`;
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.revokeQrUrl());
    this.loadStatus();
    this.loadWebhookConfig();
    this.startStatusPolling();
  }

  private startStatusPolling(): void {
    if (this.statusPollingStarted) {
      return;
    }
    this.statusPollingStarted = true;

    timer(0, 5000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadStatus());
  }

  private loadStatus(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.agentService
      .getStatus()
      .pipe(
        catchError(() => {
          this.errorMessage.set(this.translate.instant('whatsappAgentAdmin.loadFailed'));
          return EMPTY;
        }),
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(status => {
        this.status.set(status);
        if (status.state === 'CONNECTED') {
          this.clearQrMessage();
          this.revokeQrUrl();
        }
      });
  }

  private loadWebhookConfig(): void {
    this.webhookConfigError.set('');

    this.agentService
      .getWebhookConfig()
      .pipe(
        catchError(() => {
          this.webhookConfigError.set(this.translate.instant('whatsappAgentAdmin.webhook.loadFailed'));
          return EMPTY;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(config => this.webhookConfig.set(config));
  }

  protected registerDevice(): void {
    if (this.isAction()) {
      return;
    }

    this.isAction.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    this.agentService
      .registerDevice()
      .pipe(
        catchError(() => {
          this.errorMessage.set(this.translate.instant('whatsappAgentAdmin.connectFailed'));
          return EMPTY;
        }),
        finalize(() => this.isAction.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(response => {
        this.status.update(current => ({ ...current, state: 'DISCONNECTED', deviceId: response.deviceId }));
        this.successMessage.set(this.translate.instant('whatsappAgentAdmin.connected'));
        this.refreshQr();
        this.loadStatus();
      });
  }

  protected reconnectDevice(): void {
    if (this.isAction() || this.isUnregistered()) {
      return;
    }

    this.isAction.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    this.agentService
      .reconnectDevice()
      .pipe(
        catchError(() => {
          this.errorMessage.set(this.translate.instant('whatsappAgentAdmin.reconnectFailed'));
          return EMPTY;
        }),
        finalize(() => this.isAction.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.successMessage.set(this.translate.instant('whatsappAgentAdmin.reconnectStarted'));
        this.refreshQr();
        this.loadStatus();
      });
  }

  protected disconnectDevice(): void {
    if (this.isAction() || this.isUnregistered()) {
      return;
    }

    this.isAction.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    this.agentService
      .disconnectDevice()
      .pipe(
        catchError(() => {
          this.errorMessage.set(this.translate.instant('whatsappAgentAdmin.disconnectFailed'));
          return EMPTY;
        }),
        finalize(() => this.isAction.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.status.set({ state: 'UNREGISTERED' });
        this.successMessage.set(this.translate.instant('whatsappAgentAdmin.disconnected'));
        this.clearQrMessage();
        this.revokeQrUrl();
      });
  }

  protected refreshQr(): void {
    if (this.isUnregistered()) {
      return;
    }

    this.clearQrMessage();
    this.agentService
      .getQr()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: blob => this.setQrUrl(blob),
        error: error => {
          void this.handleQrError(error);
        },
      });
  }

  private setQrUrl(blob: Blob): void {
    this.revokeQrUrl();
    this.qrBlobUrl.set(URL.createObjectURL(blob));
  }

  private revokeQrUrl(): void {
    const current = this.qrBlobUrl();
    if (!current) {
      return;
    }
    URL.revokeObjectURL(current);
    this.qrBlobUrl.set(null);
  }

  private clearQrMessage(): void {
    this.qrMessage.set('');
    this.qrMessageVariant.set('error');
  }

  private async handleQrError(error: unknown): Promise<void> {
    this.revokeQrUrl();
    const resolution = await resolveWhatsAppQrError(error, this.translate);
    this.qrMessage.set(resolution.message || this.translate.instant('whatsappAgentAdmin.qrFailed'));
    this.qrMessageVariant.set(resolution.variant);
  }

  protected async copyCallbackUrl(): Promise<void> {
    const value = this.callbackUrlWithQuery();
    if (!value || !globalThis.navigator?.clipboard) {
      return;
    }
    await globalThis.navigator.clipboard.writeText(value);
    this.callbackCopied.set(true);
    setTimeout(() => this.callbackCopied.set(false), 3000);
  }

  protected async copySecret(): Promise<void> {
    const value = this.webhookConfig()?.sharedSecret;
    if (!value || !globalThis.navigator?.clipboard) {
      return;
    }
    await globalThis.navigator.clipboard.writeText(value);
    this.secretCopied.set(true);
    setTimeout(() => this.secretCopied.set(false), 3000);
  }
}