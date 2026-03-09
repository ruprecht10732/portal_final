import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, finalize, Subscription, timer } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { OrganizationService, WhatsAppStatus } from '../../../../core/services/organization.service';
import { CreateWebhookAPIKeyResponse, WebhookAPIKey, WebhookService } from '../../../../core/services/webhook.service';
import { environment } from '../../../../../environments/environment';
import { localizeWhatsAppStatusMessage } from '../../../../core/utils/whatsapp-status.util';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { CardComponent } from '../../../../shared/components/card/card.component';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { PageLayoutComponent } from '../../../../shared/components/page-layout/page-layout.component';
import { SkeletonComponent } from '../../../../shared/components/skeleton/skeleton.component';

@Component({
  selector: 'app-organization-whatsapp-settings',
  imports: [ButtonComponent, CardComponent, ConfirmDialogComponent, InputComponent, PageLayoutComponent, SkeletonComponent, TranslatePipe],
  templateUrl: './organization-whatsapp-settings.component.html',
  styleUrl: './organization-whatsapp-settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationWhatsAppSettingsComponent {
  protected readonly orgPhoneNumber = signal('');
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal('');

  protected readonly whatsAppDeviceId = signal<string | null>(null);
  protected readonly whatsAppAccountJid = signal<string | null>(null);
  protected readonly whatsAppStatus = signal<WhatsAppStatus | null>(null);
  protected readonly isWhatsAppLoading = signal(false);
  protected readonly isWhatsAppAction = signal(false);
  protected readonly whatsAppErrorMessage = signal('');
  protected readonly whatsAppSuccessMessage = signal('');
  protected readonly isWhatsAppTesting = signal(false);
  protected readonly whatsAppTestMessage = signal('');
  protected readonly qrBlobUrl = signal<string | null>(null);
  protected readonly webhookKeys = signal<WebhookAPIKey[]>([]);
  protected readonly isWebhookKeysLoading = signal(true);
  protected readonly isWebhookKeySaving = signal(false);
  protected readonly whatsAppWebhookErrorMessage = signal('');
  protected readonly whatsAppWebhookSuccessMessage = signal('');
  protected readonly showWebhookCreateForm = signal(false);
  protected readonly webhookKeyName = signal('');
  protected readonly webhookKeyDomains = signal('');
  protected readonly createdWebhookKey = signal<CreateWebhookAPIKeyResponse | null>(null);
  protected readonly rotateWebhookSource = signal<WebhookAPIKey | null>(null);
  protected readonly revokeWebhookTarget = signal<WebhookAPIKey | null>(null);
  protected readonly webhookKeyCopied = signal(false);
  protected readonly webhookUrlCopied = signal(false);

  private statusPollingStarted = false;
  private qrRefreshSub: Subscription | null = null;
  private qrLoadInFlight = false;

  private readonly orgService = inject(OrganizationService);
  private readonly webhookService = inject(WebhookService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);

  protected readonly isWhatsAppConnected = computed(() => this.whatsAppStatus()?.state === 'CONNECTED');
  protected readonly isWhatsAppUnregistered = computed(() => !this.whatsAppDeviceId());
  protected readonly qrUrl = computed(() => this.qrBlobUrl() ?? '');
  protected readonly providerDeviceId = computed(() => {
    return this.whatsAppStatus()?.deviceId?.trim() || this.whatsAppDeviceId()?.trim() || '';
  });
  protected readonly pairedAccountJid = computed(() => {
    return this.whatsAppStatus()?.accountJid?.trim() || this.whatsAppAccountJid()?.trim() || '';
  });
  protected readonly pairedAccountJidPending = computed(() => !this.isWhatsAppUnregistered() && !this.pairedAccountJid());
  protected readonly activeWebhookKeys = computed(() => this.webhookKeys().filter(key => key.isActive));
  protected readonly showWebhookRevokeDialog = computed(() => this.revokeWebhookTarget() !== null);
  protected readonly whatsAppWebhookUrl = computed(() => `${environment.apiBaseUrl}/webhook/whatsapp`);
  protected readonly whatsAppProviderWebhookUrl = computed(() => {
    const created = this.createdWebhookKey();
    if (!created) {
      return '';
    }
    return `${this.whatsAppWebhookUrl()}?api_key=${encodeURIComponent(created.key)}`;
  });
  protected readonly whatsAppStatusMessage = computed(() => {
    return localizeWhatsAppStatusMessage(this.whatsAppStatus()?.message, this.translate);
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.revokeQrUrl();
      this.stopQrRefreshCycle();
    });

    this.loadSettings();
    this.loadWhatsAppWebhookKeys();
  }

  private loadSettings(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.orgService
      .getSettings()
      .pipe(
        catchError(() => {
          this.errorMessage.set(this.translate.instant('organization.settings.loadFailed'));
          return EMPTY;
        }),
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(settings => {
        this.whatsAppDeviceId.set(settings.whatsAppDeviceId ?? null);
        this.whatsAppAccountJid.set(settings.whatsAppAccountJid ?? null);

        this.startStatusPolling();
      });

  this.orgService
    .getOrganization()
    .pipe(
      catchError(() => EMPTY),
      takeUntilDestroyed(this.destroyRef)
    )
    .subscribe(org => {
      this.orgPhoneNumber.set((org.phone ?? '').trim());
    });
  }

  private startStatusPolling(): void {
    if (this.statusPollingStarted) return;
    this.statusPollingStarted = true;

    timer(0, 5000)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(() => EMPTY)
      )
      .subscribe(() => this.loadWhatsAppStatus());
  }

  private loadWhatsAppStatus(): void {
    this.isWhatsAppLoading.set(true);
    this.whatsAppErrorMessage.set('');

    this.orgService
      .getWhatsAppStatus()
      .pipe(
        catchError(() => {
          this.whatsAppErrorMessage.set(this.translate.instant('organization.settings.whatsapp.loadFailed'));
          return EMPTY;
        }),
        finalize(() => this.isWhatsAppLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(status => {
        const prev = this.whatsAppStatus();
        this.whatsAppStatus.set(status);
        this.whatsAppDeviceId.set(status.deviceId?.trim() || this.whatsAppDeviceId());
        this.whatsAppAccountJid.set(status.accountJid?.trim() || this.whatsAppAccountJid());

        if (status.state === 'CONNECTED') {
          this.stopQrRefreshCycle();
          this.revokeQrUrl();
          return;
        }

        if (status.needsReauth && !prev?.needsReauth) {
          this.startQrRefreshCycle();
        }
      });
  }

  private startQrRefreshCycle(): void {
    if (this.qrRefreshSub) return;

    this.qrRefreshSub = timer(0, 20_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadWhatsAppQr());
  }

  private stopQrRefreshCycle(): void {
    this.qrRefreshSub?.unsubscribe();
    this.qrRefreshSub = null;
  }

  private loadWhatsAppQr(): void {
    if (this.isWhatsAppUnregistered() || this.qrLoadInFlight) return;

    this.qrLoadInFlight = true;

    this.orgService
      .getWhatsAppQr()
      .pipe(
        catchError(() => {
          this.whatsAppErrorMessage.set(this.translate.instant('organization.settings.whatsapp.qrFailed'));
          return EMPTY;
        }),
        finalize(() => (this.qrLoadInFlight = false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(blob => this.setQrUrl(blob));
  }

  private setQrUrl(blob: Blob): void {
    this.revokeQrUrl();
    const url = URL.createObjectURL(blob);
    this.qrBlobUrl.set(url);
  }

  private revokeQrUrl(): void {
    const current = this.qrBlobUrl();
    if (!current) return;
    URL.revokeObjectURL(current);
    this.qrBlobUrl.set(null);
  }

  protected connectWhatsApp(): void {
    if (this.isWhatsAppAction()) return;

    this.isWhatsAppAction.set(true);
    this.whatsAppErrorMessage.set('');
    this.whatsAppSuccessMessage.set('');

    this.orgService
      .registerWhatsAppDevice()
      .pipe(
        catchError(() => {
          this.whatsAppErrorMessage.set(this.translate.instant('organization.settings.whatsapp.connectFailed'));
          return EMPTY;
        }),
        finalize(() => this.isWhatsAppAction.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(response => {
        this.whatsAppDeviceId.set(response.deviceId);
        this.whatsAppAccountJid.set(null);
        this.whatsAppSuccessMessage.set(this.translate.instant('organization.settings.whatsapp.connected'));
        this.refreshQr();
        this.loadWhatsAppStatus();
      });
  }

  protected reconnectWhatsApp(): void {
    if (this.isWhatsAppAction() || this.isWhatsAppUnregistered()) return;

    this.isWhatsAppAction.set(true);
    this.whatsAppErrorMessage.set('');
    this.whatsAppSuccessMessage.set('');

    this.orgService
      .reconnectWhatsApp()
      .pipe(
        catchError(() => {
          this.whatsAppErrorMessage.set(this.translate.instant('organization.settings.whatsapp.reconnectFailed'));
          return EMPTY;
        }),
        finalize(() => this.isWhatsAppAction.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.whatsAppSuccessMessage.set(this.translate.instant('organization.settings.whatsapp.reconnectStarted'));
        this.refreshQr();
        this.loadWhatsAppStatus();
      });
  }

  protected disconnectWhatsApp(): void {
    if (this.isWhatsAppAction() || this.isWhatsAppUnregistered()) return;

    this.isWhatsAppAction.set(true);
    this.whatsAppErrorMessage.set('');
    this.whatsAppSuccessMessage.set('');

    this.orgService
      .disconnectWhatsApp()
      .pipe(
        catchError(() => {
          this.whatsAppErrorMessage.set(this.translate.instant('organization.settings.whatsapp.disconnectFailed'));
          return EMPTY;
        }),
        finalize(() => this.isWhatsAppAction.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.whatsAppDeviceId.set(null);
        this.whatsAppAccountJid.set(null);
        this.whatsAppStatus.set({ state: 'UNREGISTERED', message: '', canSend: false, needsReauth: false, presence: 'available' });
        this.whatsAppSuccessMessage.set(this.translate.instant('organization.settings.whatsapp.disconnected'));
        this.revokeQrUrl();
      });
  }

  protected refreshQr(): void {
    this.stopQrRefreshCycle();
    this.startQrRefreshCycle();
  }

  protected sendWhatsAppTest(): void {
    if (this.isWhatsAppAction() || this.isWhatsAppTesting()) return;

    this.isWhatsAppTesting.set(true);
    this.whatsAppErrorMessage.set('');
    this.whatsAppSuccessMessage.set('');
    this.whatsAppTestMessage.set('');

    this.orgService
      .testWhatsApp()
      .pipe(
        catchError(() => {
          this.whatsAppErrorMessage.set(this.translate.instant('organization.settings.whatsapp.testFailed'));
          return EMPTY;
        }),
        finalize(() => this.isWhatsAppTesting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(response => {
        this.whatsAppTestMessage.set(this.translate.instant('organization.settings.whatsapp.testSent', { phone: response.phoneNumber }));
      });
  }

  protected toggleWebhookCreateForm(): void {
  this.showWebhookCreateForm.update(value => !value);
  if (!this.showWebhookCreateForm()) {
    this.webhookKeyName.set('');
    this.webhookKeyDomains.set('');
    this.rotateWebhookSource.set(null);
  }
  this.whatsAppWebhookErrorMessage.set('');
  this.whatsAppWebhookSuccessMessage.set('');
  }

  protected createWhatsAppWebhookKey(): void {
  const name = this.webhookKeyName().trim();
  if (!name) {
    this.whatsAppWebhookErrorMessage.set(this.translate.instant('webhook.errors.nameRequired'));
    return;
  }

  const domains = this.webhookKeyDomains()
    .split(',')
    .map(domain => domain.trim())
    .filter(domain => domain !== '');

  this.isWebhookKeySaving.set(true);
  this.whatsAppWebhookErrorMessage.set('');
  this.whatsAppWebhookSuccessMessage.set('');
  this.createdWebhookKey.set(null);
  this.webhookKeyCopied.set(false);
  this.webhookUrlCopied.set(false);

  this.webhookService
    .create({ name, allowedDomains: domains })
    .pipe(
      catchError(error => {
        this.whatsAppWebhookErrorMessage.set(this.normalizeApiError(error, 'webhook.errors.generic'));
        return EMPTY;
      }),
      finalize(() => this.isWebhookKeySaving.set(false)),
      takeUntilDestroyed(this.destroyRef),
    )
    .subscribe(response => {
      this.createdWebhookKey.set(response);
      this.showWebhookCreateForm.set(false);
      this.webhookKeyName.set('');
      this.webhookKeyDomains.set('');
      if (this.rotateWebhookSource()) {
        this.whatsAppWebhookSuccessMessage.set(this.translate.instant('webhook.rotate.created'));
      }
      this.loadWhatsAppWebhookKeys();
    });
  }

  protected rotateWhatsAppWebhookKey(key: WebhookAPIKey): void {
  this.rotateWebhookSource.set(key);
  this.showWebhookCreateForm.set(true);
  this.webhookKeyName.set(`${key.name} ${this.translate.instant('webhook.rotate.suffix')}`.trim());
  this.webhookKeyDomains.set(key.allowedDomains.join(', '));
  this.createdWebhookKey.set(null);
  this.whatsAppWebhookErrorMessage.set('');
  this.whatsAppWebhookSuccessMessage.set('');
  }

  protected confirmRevokeWhatsAppWebhookKey(key: WebhookAPIKey): void {
  this.revokeWebhookTarget.set(key);
  }

  protected cancelRevokeWhatsAppWebhookKey(): void {
  this.revokeWebhookTarget.set(null);
  }

  protected revokeWhatsAppWebhookKey(): void {
  const target = this.revokeWebhookTarget();
  if (!target) {
    return;
  }

  this.isWebhookKeySaving.set(true);
  this.revokeWebhookTarget.set(null);
  this.whatsAppWebhookErrorMessage.set('');
  this.whatsAppWebhookSuccessMessage.set('');

  this.webhookService
    .revoke(target.id)
    .pipe(
      catchError(error => {
        this.whatsAppWebhookErrorMessage.set(this.normalizeApiError(error, 'webhook.errors.generic'));
        return EMPTY;
      }),
      finalize(() => this.isWebhookKeySaving.set(false)),
      takeUntilDestroyed(this.destroyRef),
    )
    .subscribe(() => {
      this.whatsAppWebhookSuccessMessage.set(this.translate.instant('webhook.revoked'));
      if (this.rotateWebhookSource()?.id === target.id) {
        this.rotateWebhookSource.set(null);
      }
      this.loadWhatsAppWebhookKeys();
    });
  }

  protected dismissCreatedWebhookKey(): void {
  this.createdWebhookKey.set(null);
  this.rotateWebhookSource.set(null);
  this.webhookKeyCopied.set(false);
  this.webhookUrlCopied.set(false);
  }

  protected async copyCreatedWebhookKey(): Promise<void> {
  const key = this.createdWebhookKey()?.key;
  if (!key || !globalThis.navigator?.clipboard) {
    return;
  }
  await globalThis.navigator.clipboard.writeText(key);
  this.webhookKeyCopied.set(true);
  setTimeout(() => this.webhookKeyCopied.set(false), 3000);
  }

  protected async copyWhatsAppWebhookUrl(): Promise<void> {
  const value = this.whatsAppProviderWebhookUrl() || this.whatsAppWebhookUrl();
  if (!value || !globalThis.navigator?.clipboard) {
    return;
  }
  await globalThis.navigator.clipboard.writeText(value);
  this.webhookUrlCopied.set(true);
  setTimeout(() => this.webhookUrlCopied.set(false), 3000);
  }

  private loadWhatsAppWebhookKeys(): void {
  this.isWebhookKeysLoading.set(true);
  this.whatsAppWebhookErrorMessage.set('');

  this.webhookService
    .list()
    .pipe(
      catchError(error => {
        this.whatsAppWebhookErrorMessage.set(this.normalizeApiError(error, 'webhook.errors.generic'));
        return EMPTY;
      }),
      finalize(() => this.isWebhookKeysLoading.set(false)),
      takeUntilDestroyed(this.destroyRef),
    )
    .subscribe(keys => this.webhookKeys.set(keys));
  }

  private normalizeApiError(error: unknown, fallbackKey: string): string {
  if (typeof error === 'string') {
    return error;
  }
  if (!error || typeof error !== 'object') {
    return this.translate.instant(fallbackKey);
  }

  const payload = error as { error?: { message?: string; error?: string } | string; message?: string };
  if (typeof payload.error === 'string' && payload.error.trim() !== '') {
    return payload.error;
  }
  if (typeof payload.error === 'object' && payload.error !== null) {
    const nested = payload.error;
    if (typeof nested.message === 'string' && nested.message.trim() !== '') {
      return nested.message;
    }
    if (typeof nested.error === 'string' && nested.error.trim() !== '') {
      return nested.error;
    }
  }
  if (typeof payload.message === 'string' && payload.message.trim() !== '') {
    return payload.message;
  }

  return this.translate.instant(fallbackKey);
  }
}
