import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, finalize, Subscription, timer } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { OrganizationService, WhatsAppStatus } from '../../../../core/services/organization.service';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { CardComponent } from '../../../../shared/components/card/card.component';
import { PageLayoutComponent } from '../../../../shared/components/page-layout/page-layout.component';
import { SkeletonComponent } from '../../../../shared/components/skeleton/skeleton.component';

@Component({
  selector: 'app-organization-whatsapp-settings',
  imports: [ButtonComponent, CardComponent, PageLayoutComponent, SkeletonComponent, TranslatePipe],
  templateUrl: './organization-whatsapp-settings.component.html',
  styleUrl: './organization-whatsapp-settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationWhatsAppSettingsComponent {
  protected readonly orgPhoneNumber = signal('');
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal('');

  protected readonly whatsAppDeviceId = signal<string | null>(null);
  protected readonly whatsAppStatus = signal<WhatsAppStatus | null>(null);
  protected readonly isWhatsAppLoading = signal(false);
  protected readonly isWhatsAppAction = signal(false);
  protected readonly whatsAppErrorMessage = signal('');
  protected readonly whatsAppSuccessMessage = signal('');
  protected readonly isWhatsAppTesting = signal(false);
  protected readonly whatsAppTestMessage = signal('');
  protected readonly qrBlobUrl = signal<string | null>(null);

  private statusPollingStarted = false;
  private qrRefreshSub: Subscription | null = null;
  private qrLoadInFlight = false;

  private readonly orgService = inject(OrganizationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);

  protected readonly isWhatsAppConnected = computed(() => this.whatsAppStatus()?.state === 'CONNECTED');
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
        this.whatsAppDeviceId.set(settings.whatsAppDeviceId ?? null);

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
}
