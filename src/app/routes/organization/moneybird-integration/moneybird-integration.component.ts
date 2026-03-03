import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, EMPTY, finalize } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { QuotesService } from '../../../core/services/quotes.service';
import { MONEYBIRD_PROVIDER } from '../../../core/services/quotes.types';
import { formatDateValue } from '../../../core/utils/date-utils';

@Component({
  selector: 'app-moneybird-integration',
  imports: [ButtonComponent, TranslatePipe],
  templateUrl: './moneybird-integration.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MoneybirdIntegrationComponent {
  protected readonly isLoading = signal(true);
  protected readonly isActionLoading = signal(false);
  protected readonly isConnected = signal(false);
  protected readonly connectedAt = signal<string | null>(null);
  protected readonly errorMessage = signal('');
  protected readonly successMessage = signal('');

  private messageTimerId: number | null = null;
  private statusPollIntervalId: number | null = null;

  protected readonly statusText = computed(() =>
    this.isConnected()
      ? this.translate.instant('organization.integrations.moneybird.states.connected')
      : this.translate.instant('organization.integrations.moneybird.states.notConnected'),
  );

  private readonly quotesService = inject(QuotesService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.clearMessageTimer();
      this.clearStatusPollInterval();
    });

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      void this.handleOAuthCallbackStatus(params.get('moneybird'));
    });

    this.loadStatus();
  }

  protected loadStatus(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.quotesService
      .getProviderIntegrationStatus(MONEYBIRD_PROVIDER)
      .pipe(
        catchError(() => {
          this.showError(this.translate.instant('organization.integrations.moneybird.errors.loadFailed'));
          return EMPTY;
        }),
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(result => {
        this.isConnected.set(result.isConnected);
        this.connectedAt.set(result.connectedAt ?? null);
      });
  }

  protected connectMoneybird(): void {
    if (this.isActionLoading()) return;

    this.isActionLoading.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    this.quotesService
      .getMoneybirdAuthorizeURL()
      .pipe(
        catchError(() => {
          this.showError(this.translate.instant('organization.integrations.moneybird.errors.connectFailed'));
          return EMPTY;
        }),
        finalize(() => this.isActionLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(result => {
        this.clearStatusPollInterval();
        const authWindow = globalThis.open(result.authorizeUrl, '_blank', 'noopener,noreferrer');
        if (!authWindow) {
          globalThis.location.assign(result.authorizeUrl);
          return;
        }

        this.showSuccess(this.translate.instant('organization.integrations.moneybird.authOpened'));

        this.statusPollIntervalId = globalThis.setInterval(() => {
          if (authWindow.closed) {
            this.clearStatusPollInterval();
            this.loadStatus();
          }
        }, 1500);
      });
  }

  protected disconnectMoneybird(): void {
    if (this.isActionLoading()) return;

    this.isActionLoading.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    this.quotesService
      .disconnectProvider(MONEYBIRD_PROVIDER)
      .pipe(
        catchError(() => {
          this.showError(this.translate.instant('organization.integrations.moneybird.errors.disconnectFailed'));
          return EMPTY;
        }),
        finalize(() => this.isActionLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.isConnected.set(false);
        this.connectedAt.set(null);
        this.showSuccess(this.translate.instant('organization.integrations.moneybird.disconnected'));
      });
  }

  protected formatDate(value: string | null): string {
    return formatDateValue(value, this.translate.currentLang || 'nl', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }

  private async clearMoneybirdQueryParam(): Promise<void> {
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { moneybird: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private async handleOAuthCallbackStatus(status: string | null): Promise<void> {
    if (status === 'connected') {
      this.showSuccess(this.translate.instant('organization.integrations.moneybird.connected'));
      await this.clearMoneybirdQueryParam();
      return;
    }

    if (status === 'error') {
      this.showError(this.translate.instant('organization.integrations.moneybird.errors.callbackFailed'));
      await this.clearMoneybirdQueryParam();
    }
  }

  private showSuccess(message: string): void {
    this.clearMessageTimer();
    this.errorMessage.set('');
    this.successMessage.set(message);
    this.scheduleMessageClear();
  }

  private showError(message: string): void {
    this.clearMessageTimer();
    this.successMessage.set('');
    this.errorMessage.set(message);
    this.scheduleMessageClear();
  }

  private scheduleMessageClear(): void {
    this.messageTimerId = globalThis.setTimeout(() => {
      this.successMessage.set('');
      this.errorMessage.set('');
      this.messageTimerId = null;
    }, 5000);
  }

  private clearMessageTimer(): void {
    if (this.messageTimerId !== null) {
      globalThis.clearTimeout(this.messageTimerId);
      this.messageTimerId = null;
    }
  }

  private clearStatusPollInterval(): void {
    if (this.statusPollIntervalId !== null) {
      globalThis.clearInterval(this.statusPollIntervalId);
      this.statusPollIntervalId = null;
    }
  }
}
