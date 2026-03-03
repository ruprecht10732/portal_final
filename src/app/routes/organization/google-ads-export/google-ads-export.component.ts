import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, finalize } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import {
  GoogleAdsExportService,
  type GoogleAdsExportCredential,
  type RevealGoogleAdsExportPasswordResponse,
  type UpsertGoogleAdsExportCredentialResponse,
} from '../../../core/services/google-ads-export.service';
import { environment } from '../../../../environments/environment';
import { formatDateValue } from '../../../core/utils/date-utils';

@Component({
  selector: 'app-google-ads-export',
  imports: [ButtonComponent, ConfirmDialogComponent, TranslatePipe, LucideAngularModule],
  templateUrl: './google-ads-export.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GoogleAdsExportComponent {
  protected readonly credential = signal<GoogleAdsExportCredential | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly isSaving = signal(false);
  protected readonly isRevealingPassword = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly successMessage = signal('');

  protected readonly generatedCredential = signal<UpsertGoogleAdsExportCredentialResponse | null>(null);
  protected readonly revealedPassword = signal<string | null>(null);
  protected readonly usernameCopied = signal(false);
  protected readonly passwordCopied = signal(false);
  protected readonly urlCopied = signal(false);

  protected readonly showDeleteDialog = signal(false);
  protected readonly hasCredential = computed(() => this.credential() !== null);

  private readonly exportService = inject(GoogleAdsExportService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);
  private readonly lang = toSignal(this.translate.onLangChange, {
    initialValue: { lang: 'nl', translations: {} },
  });

  protected readonly exportUrl = computed(() => `${environment.apiBaseUrl}/exports/google-ads/conversions.csv`);

  constructor() {
    this.loadCredential();
  }

  protected loadCredential(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');
    this.revealedPassword.set(null);

    this.exportService
      .getCredential()
      .pipe(
        catchError(error => {
          const status = this.getStatusCode(error);
          if (status === 404) {
            this.credential.set(null);
            return EMPTY;
          }
          this.errorMessage.set(this.normalizeError(error));
          return EMPTY;
        }),
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(credential => this.credential.set(credential));
  }

  protected generateOrRotateCredential(): void {
    this.isSaving.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.generatedCredential.set(null);
    this.revealedPassword.set(null);
    this.usernameCopied.set(false);
    this.passwordCopied.set(false);
    this.urlCopied.set(false);

    this.exportService
      .upsertCredential()
      .pipe(
        catchError(error => {
          this.errorMessage.set(this.normalizeError(error));
          return EMPTY;
        }),
        finalize(() => this.isSaving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(response => {
        this.generatedCredential.set(response);
        this.credential.set(response);
        this.successMessage.set(this.translate.instant('googleAds.credentialSaved'));
      });
  }

  protected confirmDeleteCredential(): void {
    this.showDeleteDialog.set(true);
  }

  protected cancelDeleteCredential(): void {
    this.showDeleteDialog.set(false);
  }

  protected executeDeleteCredential(): void {
    this.isSaving.set(true);
    this.errorMessage.set('');
    this.showDeleteDialog.set(false);

    this.exportService
      .deleteCredential()
      .pipe(
        catchError(error => {
          this.errorMessage.set(this.normalizeError(error));
          return EMPTY;
        }),
        finalize(() => this.isSaving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.credential.set(null);
        this.generatedCredential.set(null);
        this.revealedPassword.set(null);
        this.successMessage.set(this.translate.instant('googleAds.credentialDeleted'));
      });
  }

  protected togglePasswordReveal(): void {
    if (this.revealedPassword()) {
      this.revealedPassword.set(null);
      return;
    }

    this.isRevealingPassword.set(true);
    this.errorMessage.set('');

    this.exportService
      .revealPassword()
      .pipe(
        catchError(error => {
          this.errorMessage.set(this.normalizeError(error));
          return EMPTY;
        }),
        finalize(() => this.isRevealingPassword.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((response: RevealGoogleAdsExportPasswordResponse) => {
        this.revealedPassword.set(response.password);
      });
  }

  protected async copyUsername(): Promise<void> {
    const username = this.credential()?.username;
    if (!username) return;
    await navigator.clipboard.writeText(username);
    this.usernameCopied.set(true);
    setTimeout(() => this.usernameCopied.set(false), 3000);
  }

  protected async copyPassword(): Promise<void> {
    const password = this.generatedCredential()?.password ?? this.revealedPassword();
    if (!password) return;
    await navigator.clipboard.writeText(password);
    this.passwordCopied.set(true);
    setTimeout(() => this.passwordCopied.set(false), 3000);
  }

  protected async copyExportUrl(): Promise<void> {
    await navigator.clipboard.writeText(this.exportUrl());
    this.urlCopied.set(true);
    setTimeout(() => this.urlCopied.set(false), 3000);
  }

  protected formatDate(value: string): string {
    const locale = this.lang().lang || 'nl';
    return formatDateValue(value, locale, { dateStyle: 'medium', timeStyle: 'short' });
  }

  protected dismissGeneratedCredential(): void {
    this.generatedCredential.set(null);
  }

  private getStatusCode(error: unknown): number | null {
    if (!error || typeof error !== 'object') return null;
    const err = error as Record<string, unknown>;
    const status = err['status'];
    return typeof status === 'number' ? status : null;
  }

  private normalizeError(error: unknown): string {
    const direct = this.getErrorString(error);
    if (direct) return direct;

    const objectError = this.getObjectErrorString(error);
    if (objectError) return objectError;

    return this.translate.instant('googleAds.errors.generic');
  }

  private getErrorString(error: unknown): string | null {
    return typeof error === 'string' ? error : null;
  }

  private getObjectErrorString(error: unknown): string | null {
    if (!error || typeof error !== 'object') return null;
    const err = error as Record<string, unknown>;

    const nested = err['error'];
    const nestedMessage = this.getNestedErrorMessage(nested);
    if (nestedMessage) return nestedMessage;

    const message = err['message'];
    return typeof message === 'string' ? message : null;
  }

  private getNestedErrorMessage(nested: unknown): string | null {
    if (typeof nested === 'string') return nested;
    if (!nested || typeof nested !== 'object') return null;
    const nestedObj = nested as Record<string, unknown>;
    const message = nestedObj['error'];
    return typeof message === 'string' ? message : null;
  }
}
