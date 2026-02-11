import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, finalize } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { GoogleAdsExportService, type GoogleAdsExportKey, type CreateGoogleAdsExportKeyResponse } from '../../../core/services/google-ads-export.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-google-ads-export',
  imports: [ButtonComponent, ConfirmDialogComponent, InputComponent, TranslatePipe, FormsModule, LucideAngularModule],
  templateUrl: './google-ads-export.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GoogleAdsExportComponent {
  protected readonly keys = signal<GoogleAdsExportKey[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly isSaving = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly successMessage = signal('');

  protected readonly showCreateForm = signal(false);
  protected readonly newKeyName = signal('');

  protected readonly createdKey = signal<CreateGoogleAdsExportKeyResponse | null>(null);
  protected readonly keyCopied = signal(false);
  protected readonly urlCopied = signal(false);

  protected readonly revokeTarget = signal<GoogleAdsExportKey | null>(null);
  protected readonly showRevokeDialog = computed(() => this.revokeTarget() !== null);

  private readonly exportService = inject(GoogleAdsExportService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);
  private readonly lang = toSignal(this.translate.onLangChange, {
    initialValue: { lang: 'nl', translations: {} },
  });

  protected readonly activeKeys = computed(() => this.keys().filter(k => k.isActive));
  protected readonly revokedKeys = computed(() => this.keys().filter(k => !k.isActive));

  protected readonly exportUrl = computed(() => `${environment.apiBaseUrl}/exports/google-ads/conversions.csv`);

  constructor() {
    this.loadKeys();
  }

  protected loadKeys(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.exportService
      .listKeys()
      .pipe(
        catchError(error => {
          this.errorMessage.set(this.normalizeError(error));
          return EMPTY;
        }),
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(keys => this.keys.set(keys));
  }

  protected toggleCreateForm(): void {
    this.showCreateForm.update(v => !v);
    if (!this.showCreateForm()) {
      this.newKeyName.set('');
    }
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  protected createKey(): void {
    const name = this.newKeyName().trim();
    if (!name) {
      this.errorMessage.set(this.translate.instant('googleAds.errors.nameRequired'));
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.createdKey.set(null);
    this.keyCopied.set(false);
    this.urlCopied.set(false);

    this.exportService
      .createKey({ name })
      .pipe(
        catchError(error => {
          this.errorMessage.set(this.normalizeError(error));
          return EMPTY;
        }),
        finalize(() => this.isSaving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(response => {
        this.createdKey.set(response);
        this.showCreateForm.set(false);
        this.newKeyName.set('');
        this.loadKeys();
      });
  }

  protected confirmRevoke(key: GoogleAdsExportKey): void {
    this.revokeTarget.set(key);
  }

  protected cancelRevoke(): void {
    this.revokeTarget.set(null);
  }

  protected executeRevoke(): void {
    const target = this.revokeTarget();
    if (!target) return;

    this.isSaving.set(true);
    this.errorMessage.set('');
    this.revokeTarget.set(null);

    this.exportService
      .revokeKey(target.id)
      .pipe(
        catchError(error => {
          this.errorMessage.set(this.normalizeError(error));
          return EMPTY;
        }),
        finalize(() => this.isSaving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.successMessage.set(this.translate.instant('googleAds.revoked'));
        this.loadKeys();
      });
  }

  protected async copyApiKey(): Promise<void> {
    const key = this.createdKey()?.key;
    if (!key) return;
    await navigator.clipboard.writeText(key);
    this.keyCopied.set(true);
    setTimeout(() => this.keyCopied.set(false), 3000);
  }

  protected async copyExportUrl(): Promise<void> {
    await navigator.clipboard.writeText(this.exportUrl());
    this.urlCopied.set(true);
    setTimeout(() => this.urlCopied.set(false), 3000);
  }

  protected formatDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    const locale = this.lang().lang || 'nl';
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }

  protected dismissCreatedKey(): void {
    this.createdKey.set(null);
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
