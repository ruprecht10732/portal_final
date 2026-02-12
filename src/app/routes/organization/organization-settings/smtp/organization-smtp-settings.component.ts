import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, distinctUntilChanged, EMPTY, filter, finalize, switchMap } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { CardComponent } from '../../../../shared/components/card/card.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { NumberInputComponent } from '../../../../shared/components/number-input/number-input.component';
import { PageLayoutComponent } from '../../../../shared/components/page-layout/page-layout.component';
import { SkeletonComponent } from '../../../../shared/components/skeleton/skeleton.component';
import { OrganizationService } from '../../../../core/services/organization.service';
import type { SMTPStatusResponse } from '../../../../core/services/organization.service';

@Component({
  selector: 'app-organization-smtp-settings',
  imports: [ButtonComponent, CardComponent, InputComponent, NumberInputComponent, PageLayoutComponent, SkeletonComponent, TranslatePipe],
  templateUrl: './organization-smtp-settings.component.html',
  styleUrl: './organization-smtp-settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationSmtpSettingsComponent {
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal('');

  // ── SMTP ──
  protected readonly smtpHost = signal('');
  protected readonly smtpPort = signal<number | null>(587);
  protected readonly smtpUsername = signal('');
  protected readonly smtpPassword = signal('');
  protected readonly smtpFromEmail = signal('');
  protected readonly smtpFromName = signal('');
  protected readonly smtpConfigured = signal(false);
  protected readonly isSmtpSaving = signal(false);
  protected readonly isSmtpTesting = signal(false);
  protected readonly isSmtpClearing = signal(false);
  protected readonly smtpErrorMessage = signal('');
  protected readonly smtpSuccessMessage = signal('');
  protected readonly smtpTestEmail = signal('');
  protected readonly showSmtpTest = signal(false);

  // ── SMTP auto-detect ──
  protected readonly smtpDetectedProvider = signal('');
  protected readonly isSmtpDetecting = signal(false);
  protected readonly smtpDetectionFailed = signal(false);
  protected readonly smtpDetectedHost = signal('');
  protected readonly smtpDetectedPort = signal<number | null>(null);
  protected readonly showSmtpAdvanced = signal(false);

  protected readonly isSmtpBusy = computed(() => this.isSmtpSaving() || this.isSmtpTesting() || this.isSmtpClearing());

  protected readonly canSaveSMTP = computed(() =>
    !this.isSmtpBusy() &&
    this.smtpHost().trim().length > 0 &&
    (this.smtpPort() ?? 0) >= 1 &&
    this.smtpUsername().trim().length > 0 &&
    (this.smtpPassword().trim().length > 0 || this.smtpConfigured()) &&
    this.smtpFromEmail().trim().length > 0 &&
    this.smtpFromName().trim().length > 0
  );

  private readonly orgService = inject(OrganizationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);

  constructor() {
    this.loadSmtpStatus();
    this.setupSmtpAutoDetect();
  }

  private setupSmtpAutoDetect(): void {
    toObservable(this.smtpFromEmail)
      .pipe(
        debounceTime(600),
        distinctUntilChanged(),
        filter(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())),
        filter(() => !this.smtpConfigured()),
        switchMap(email => {
          this.isSmtpDetecting.set(true);
          this.smtpDetectedProvider.set('');
          this.smtpDetectionFailed.set(false);
          this.smtpDetectedHost.set('');
          this.smtpDetectedPort.set(null);

          if (!this.smtpUsername().trim()) {
            this.smtpUsername.set(email.trim());
          }

          return this.orgService.detectSMTP(email.trim()).pipe(
            catchError(() => {
              this.smtpDetectedProvider.set('');
              this.smtpDetectionFailed.set(true);
              this.showSmtpAdvanced.set(true);
              return EMPTY;
            }),
            finalize(() => this.isSmtpDetecting.set(false))
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(result => {
        if (!result.detected || !result.host) {
          this.smtpDetectionFailed.set(true);
          this.showSmtpAdvanced.set(true);
          return;
        }

        this.smtpDetectionFailed.set(false);
        if (result.provider) this.smtpDetectedProvider.set(result.provider);
        if (result.host) {
          this.smtpHost.set(result.host);
          this.smtpDetectedHost.set(result.host);
        }
        if (result.port) {
          this.smtpPort.set(result.port);
          this.smtpDetectedPort.set(result.port);
        }
        if (result.username) this.smtpUsername.set(result.username);
        this.showSmtpAdvanced.set(false);
      });
  }

  private loadSmtpStatus(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.orgService
      .getSMTPStatus()
      .pipe(
        catchError(() => {
          this.errorMessage.set(this.translate.instant('organization.settings.smtp.loadFailed'));
          return EMPTY;
        }),
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(status => this.applySmtpStatus(status));
  }

  private applySmtpStatus(status: SMTPStatusResponse): void {
    this.smtpConfigured.set(status.configured);
    if (!status.configured) {
      return;
    }

    this.smtpHost.set(status.host ?? '');
    this.smtpPort.set(status.port ?? 587);
    this.smtpUsername.set(status.username ?? '');
    this.smtpFromEmail.set(status.fromEmail ?? '');
    this.smtpFromName.set(status.fromName ?? '');
    this.smtpPassword.set('');
    this.showSmtpAdvanced.set(true);
  }

  protected saveSMTP(): void {
    if (!this.canSaveSMTP()) return;

    this.isSmtpSaving.set(true);
    this.smtpErrorMessage.set('');
    this.smtpSuccessMessage.set('');

    this.orgService
      .setSMTP({
        host: this.smtpHost().trim(),
        port: this.smtpPort() ?? 587,
        username: this.smtpUsername().trim(),
        password: this.smtpPassword().trim(),
        fromEmail: this.smtpFromEmail().trim(),
        fromName: this.smtpFromName().trim(),
      })
      .pipe(
        catchError(() => {
          this.smtpErrorMessage.set(this.translate.instant('organization.settings.smtp.saveFailed'));
          return EMPTY;
        }),
        finalize(() => this.isSmtpSaving.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.smtpConfigured.set(true);
        this.smtpPassword.set('');
        this.smtpSuccessMessage.set(this.translate.instant('organization.settings.smtp.saved'));
      });
  }

  protected clearSMTP(): void {
    if (this.isSmtpBusy()) return;

    this.isSmtpClearing.set(true);
    this.smtpErrorMessage.set('');
    this.smtpSuccessMessage.set('');

    this.orgService
      .clearSMTP()
      .pipe(
        catchError(() => {
          this.smtpErrorMessage.set(this.translate.instant('organization.settings.smtp.clearFailed'));
          return EMPTY;
        }),
        finalize(() => this.isSmtpClearing.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.smtpConfigured.set(false);
        this.smtpHost.set('');
        this.smtpPort.set(587);
        this.smtpUsername.set('');
        this.smtpPassword.set('');
        this.smtpFromEmail.set('');
        this.smtpFromName.set('');
        this.showSmtpTest.set(false);
        this.smtpTestEmail.set('');
        this.showSmtpAdvanced.set(false);
        this.smtpSuccessMessage.set(this.translate.instant('organization.settings.smtp.cleared'));
      });
  }

  protected testSMTP(): void {
    if (this.isSmtpBusy() || !this.smtpTestEmail().trim()) return;

    this.isSmtpTesting.set(true);
    this.smtpErrorMessage.set('');
    this.smtpSuccessMessage.set('');

    this.orgService
      .testSMTP({ toEmail: this.smtpTestEmail().trim() })
      .pipe(
        catchError(() => {
          this.smtpErrorMessage.set(this.translate.instant('organization.settings.smtp.testFailed'));
          this.showSmtpAdvanced.set(true);
          return EMPTY;
        }),
        finalize(() => this.isSmtpTesting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.smtpSuccessMessage.set(this.translate.instant('organization.settings.smtp.testSent'));
      });
  }
}
