import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, finalize } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { WebhookService, WebhookAPIKey, CreateWebhookAPIKeyResponse } from '../../../core/services/webhook.service';
import { environment } from '../../../../environments/environment';
import { formatDateValue } from '../../../core/utils/date-utils';

@Component({
  selector: 'app-webhook-keys',
  imports: [
    ButtonComponent,
    ConfirmDialogComponent,
    InputComponent,
    TranslatePipe,
    FormsModule,
    LucideAngularModule,
  ],
  templateUrl: './webhook-keys.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WebhookKeysComponent {
  // ---- State ----
  protected readonly keys = signal<WebhookAPIKey[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly isSaving = signal(false);

  // GTM config state
  protected readonly gtmContainerId = signal('');
  protected readonly isGtmLoading = signal(true);
  protected readonly isGtmSaving = signal(false);

  protected readonly errorMessage = signal('');
  protected readonly successMessage = signal('');

  // Create form state
  protected readonly showCreateForm = signal(false);
  protected readonly newKeyName = signal('');
  protected readonly newKeyDomains = signal('');

  // Newly created key (shown once)
  protected readonly createdKey = signal<CreateWebhookAPIKeyResponse | null>(null);
  protected readonly keyCopied = signal(false);
  protected readonly snippetCopied = signal(false);

  // Revoke confirm dialog
  protected readonly revokeTarget = signal<WebhookAPIKey | null>(null);
  protected readonly showRevokeDialog = computed(() => this.revokeTarget() !== null);

  private readonly webhookService = inject(WebhookService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);
  private readonly lang = toSignal(this.translate.onLangChange, {
    initialValue: { lang: 'nl', translations: {} },
  });

  protected readonly activeKeys = computed(() => this.keys().filter(k => k.isActive));
  protected readonly revokedKeys = computed(() => this.keys().filter(k => !k.isActive));

  protected readonly sdkBaseUrl = computed(() => {
    const base = environment.apiBaseUrl;
    return `${base}/webhook/sdk.js`;
  });

  protected readonly sdkSnippet = computed(() => {
    const created = this.createdKey();
    if (!created) return '';
    return `<script src="${this.sdkBaseUrl()}" data-api-key="${created.key}" defer></script>`;
  });

  private readonly gtmContainerIdRegex = /^GTM-[A-Z0-9]+$/;

  constructor() {
    this.loadKeys();
    this.loadGTMConfig();
  }

  // ---- Data loading ----

  protected loadKeys(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.webhookService
      .list()
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

  protected loadGTMConfig(): void {
    this.isGtmLoading.set(true);

    this.webhookService
      .getGTMConfig()
      .pipe(
        catchError(error => {
          this.errorMessage.set(this.normalizeError(error));
          return EMPTY;
        }),
        finalize(() => this.isGtmLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(cfg => this.gtmContainerId.set(cfg.gtmContainerId ?? ''));
  }

  protected saveGTMConfig(): void {
    const raw = this.gtmContainerId().trim().toUpperCase();
    if (!raw || !this.gtmContainerIdRegex.test(raw)) {
      this.errorMessage.set(this.translate.instant('webhook.gtm.errors.invalid'));
      return;
    }

    this.isGtmSaving.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    this.webhookService
      .updateGTMConfig({ gtmContainerId: raw })
      .pipe(
        catchError(error => {
          this.errorMessage.set(this.normalizeError(error));
          return EMPTY;
        }),
        finalize(() => this.isGtmSaving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(cfg => {
        this.gtmContainerId.set(cfg.gtmContainerId ?? raw);
        this.successMessage.set(this.translate.instant('webhook.gtm.saved'));
      });
  }

  protected clearGTMConfig(): void {
    this.isGtmSaving.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    this.webhookService
      .deleteGTMConfig()
      .pipe(
        catchError(error => {
          this.errorMessage.set(this.normalizeError(error));
          return EMPTY;
        }),
        finalize(() => this.isGtmSaving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.gtmContainerId.set('');
        this.successMessage.set(this.translate.instant('webhook.gtm.cleared'));
      });
  }

  // ---- Create ----

  protected toggleCreateForm(): void {
    this.showCreateForm.update(v => !v);
    if (!this.showCreateForm()) {
      this.newKeyName.set('');
      this.newKeyDomains.set('');
    }
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  protected createKey(): void {
    const name = this.newKeyName().trim();
    if (!name) {
      this.errorMessage.set(this.translate.instant('webhook.errors.nameRequired'));
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.createdKey.set(null);
    this.keyCopied.set(false);
    this.snippetCopied.set(false);

    const domains = this.newKeyDomains()
      .split(',')
      .map(d => d.trim())
      .filter(d => d.length > 0);

    this.webhookService
      .create({ name, allowedDomains: domains })
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
        this.newKeyDomains.set('');
        this.loadKeys();
      });
  }

  // ---- Revoke ----

  protected confirmRevoke(key: WebhookAPIKey): void {
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

    this.webhookService
      .revoke(target.id)
      .pipe(
        catchError(error => {
          this.errorMessage.set(this.normalizeError(error));
          return EMPTY;
        }),
        finalize(() => this.isSaving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.successMessage.set(this.translate.instant('webhook.revoked'));
        this.loadKeys();
      });
  }

  // ---- Clipboard ----

  protected async copyApiKey(): Promise<void> {
    const key = this.createdKey()?.key;
    if (!key) return;
    await navigator.clipboard.writeText(key);
    this.keyCopied.set(true);
    setTimeout(() => this.keyCopied.set(false), 3000);
  }

  protected async copySnippet(): Promise<void> {
    const snippet = this.sdkSnippet();
    if (!snippet) return;
    await navigator.clipboard.writeText(snippet);
    this.snippetCopied.set(true);
    setTimeout(() => this.snippetCopied.set(false), 3000);
  }

  // ---- Helpers ----

  protected formatDate(value: string): string {
    const locale = this.lang().lang || 'nl';
    return formatDateValue(value, locale, { dateStyle: 'medium', timeStyle: 'short' });
  }

  protected dismissCreatedKey(): void {
    this.createdKey.set(null);
  }

  private normalizeError(error: unknown): string {
    if (typeof error === 'string') return error;
    if (!error || typeof error !== 'object') {
      return this.translate.instant('webhook.errors.generic');
    }

    const err = error as Record<string, unknown>;
    return this.extractNestedError(err) ?? this.extractMessageField(err) ?? this.translate.instant('webhook.errors.generic');
  }

  private extractNestedError(err: Record<string, unknown>): string | null {
    const nested = err['error'];
    if (typeof nested === 'string') return nested;
    if (!nested || typeof nested !== 'object') return null;

    const nestedMessage = (nested as Record<string, unknown>)['error'];
    return typeof nestedMessage === 'string' ? nestedMessage : null;
  }

  private extractMessageField(err: Record<string, unknown>): string | null {
    const message = err['message'];
    return typeof message === 'string' ? message : null;
  }
}
