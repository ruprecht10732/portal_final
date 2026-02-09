import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, finalize, Subscription, timer } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { NumberInputComponent } from '../../../shared/components/number-input/number-input.component';
import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';
import { CardComponent } from '../../../shared/components/card/card.component';
import { SkeletonComponent } from '../../../shared/components/skeleton/skeleton.component';
import { OrganizationService, WhatsAppStatus } from '../../../core/services/organization.service';

@Component({
  selector: 'app-organization-settings',
  imports: [ButtonComponent, NumberInputComponent, PageLayoutComponent, CardComponent, SkeletonComponent, TranslatePipe],
  templateUrl: './organization-settings.component.html',
  styleUrl: './organization-settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationSettingsComponent {
  protected readonly quotePaymentDays = signal<number | null>(7);
  private readonly initialQuotePaymentDays = signal<number>(7);
  protected readonly quoteValidDays = signal<number | null>(14);
  private readonly initialQuoteValidDays = signal<number>(14);

  protected readonly isLoading = signal(true);
  protected readonly isSaving = signal(false);
  protected readonly successMessage = signal('');
  protected readonly errorMessage = signal('');

  protected readonly whatsAppDeviceId = signal<string | null>(null);
  protected readonly whatsAppStatus = signal<WhatsAppStatus | null>(null);
  protected readonly isWhatsAppLoading = signal(false);
  protected readonly isWhatsAppAction = signal(false);
  protected readonly whatsAppErrorMessage = signal('');
  protected readonly whatsAppSuccessMessage = signal('');
  protected readonly qrBlobUrl = signal<string | null>(null);
  private statusPollingStarted = false;
  /** Tracks whether QR auto-refresh is running so we don't stack timers. */
  private qrRefreshSub: Subscription | null = null;
  /** Prevent loading a QR while a previous request is still in-flight. */
  private qrLoadInFlight = false;

  private readonly orgService = inject(OrganizationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);

  protected readonly hasChanges = computed(() =>
    (this.quotePaymentDays() ?? this.initialQuotePaymentDays()) !== this.initialQuotePaymentDays() ||
    (this.quoteValidDays() ?? this.initialQuoteValidDays()) !== this.initialQuoteValidDays()
  );

  protected readonly canSave = computed(() =>
    !this.isSaving() &&
    this.hasChanges() &&
    (this.quotePaymentDays() ?? 0) >= 1 &&
    (this.quoteValidDays() ?? 0) >= 1
  );

  protected readonly isWhatsAppConnected = computed(() => this.whatsAppStatus()?.state === 'CONNECTED');
  protected readonly needsWhatsAppReauth = computed(() => !!this.whatsAppStatus()?.needsReauth);
  protected readonly isWhatsAppUnregistered = computed(() => !this.whatsAppDeviceId());

  protected readonly qrUrl = computed(() => this.qrBlobUrl() ?? '');

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.revokeQrUrl();
      this.stopQrRefreshCycle();
    });
    this.loadSettings();
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
        this.quotePaymentDays.set(settings.quotePaymentDays);
        this.initialQuotePaymentDays.set(settings.quotePaymentDays);
        this.quoteValidDays.set(settings.quoteValidDays);
        this.initialQuoteValidDays.set(settings.quoteValidDays);
        this.whatsAppDeviceId.set(settings.whatsAppDeviceId ?? null);
        this.startStatusPolling();
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

        // When device becomes connected, stop QR refresh cycle.
        if (status.state === 'CONNECTED') {
          this.stopQrRefreshCycle();
          this.revokeQrUrl();
          return;
        }

        // Start a QR auto-refresh cycle when needsReauth transitions to true,
        // but only once (the cycle self-maintains via its own timer).
        if (status.needsReauth && !prev?.needsReauth) {
          this.startQrRefreshCycle();
        }
      });
  }

  /**
   * Starts a timer that auto-refreshes the QR code every 20 seconds.
   * WhatsApp QRs expire in ~20s so this keeps a valid QR visible.
   */
  private startQrRefreshCycle(): void {
    if (this.qrRefreshSub) return; // already running

    this.qrRefreshSub = timer(0, 20_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadWhatsAppQr());
  }

  /** Stops the QR auto-refresh timer. */
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
        this.whatsAppStatus.set({ state: 'UNREGISTERED', message: '', canSend: false, needsReauth: false });
        this.whatsAppSuccessMessage.set(this.translate.instant('organization.settings.whatsapp.disconnected'));
        this.revokeQrUrl();
      });
  }

  protected refreshQr(): void {
    // Force an immediate QR load; also (re)start the auto-refresh cycle.
    this.stopQrRefreshCycle();
    this.startQrRefreshCycle();
  }

  protected save(): void {
    if (!this.canSave()) return;

    this.isSaving.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    this.orgService
      .updateSettings({
        ...(this.quotePaymentDays() == null ? {} : { quotePaymentDays: this.quotePaymentDays()! }),
        ...(this.quoteValidDays() == null ? {} : { quoteValidDays: this.quoteValidDays()! }),
      })
      .pipe(
        catchError(() => {
          this.errorMessage.set(this.translate.instant('organization.settings.saveFailed'));
          return EMPTY;
        }),
        finalize(() => this.isSaving.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(settings => {
        this.quotePaymentDays.set(settings.quotePaymentDays);
        this.initialQuotePaymentDays.set(settings.quotePaymentDays);
        this.quoteValidDays.set(settings.quoteValidDays);
        this.initialQuoteValidDays.set(settings.quoteValidDays);
        this.successMessage.set(this.translate.instant('organization.settings.saved'));
      });
  }
}
