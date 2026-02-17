import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, finalize } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import {
  CreateGoogleWebhookConfigResponse,
  GoogleWebhookConfig,
  UpdateGoogleCampaignMappingRequest,
  WebhookService,
} from '../../../core/services/webhook.service';
import { environment } from '../../../../environments/environment';
import { formatDateValue } from '../../../core/utils/date-utils';

@Component({
  selector: 'app-google-lead-webhooks',
  imports: [
    ButtonComponent,
    ConfirmDialogComponent,
    InputComponent,
    TranslatePipe,
    FormsModule,
    LucideAngularModule,
  ],
  templateUrl: './google-lead-webhooks.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GoogleLeadWebhooksComponent {
  // ---- State ----
  protected readonly configs = signal<GoogleWebhookConfig[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly isSaving = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly successMessage = signal('');

  // Create form state
  protected readonly showCreateForm = signal(false);
  protected readonly newConfigName = signal('');

  // Newly created config (shown once)
  protected readonly createdConfig = signal<CreateGoogleWebhookConfigResponse | null>(null);
  protected readonly keyCopied = signal(false);
  protected readonly urlCopied = signal(false);

  // Delete confirm dialog
  protected readonly deleteTarget = signal<GoogleWebhookConfig | null>(null);
  protected readonly showDeleteDialog = computed(() => this.deleteTarget() !== null);

  // Mapping delete confirm dialog
  protected readonly mappingDeleteTarget = signal<{ configId: string; campaignId: string } | null>(null);
  protected readonly showMappingDeleteDialog = computed(() => this.mappingDeleteTarget() !== null);

  // Mapping inputs per config
  protected readonly mappingInputs = signal<Record<string, { campaignId: string; serviceType: string }>>({});

  private readonly webhookService = inject(WebhookService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);
  private readonly lang = toSignal(this.translate.onLangChange, {
    initialValue: { lang: 'nl', translations: {} },
  });

  protected readonly activeConfigs = computed(() => this.configs().filter(c => c.isActive));
  protected readonly googleWebhookUrl = computed(() => `${environment.apiBaseUrl}/webhook/google-leads`);

  constructor() {
    this.loadConfigs();
  }

  // ---- Data loading ----

  protected loadConfigs(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.webhookService
      .listGoogleConfigs()
      .pipe(
        catchError(error => {
          this.errorMessage.set(this.normalizeError(error));
          return EMPTY;
        }),
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(configs => this.configs.set(configs));
  }

  // ---- Create ----

  protected toggleCreateForm(): void {
    this.showCreateForm.update(v => !v);
    if (!this.showCreateForm()) {
      this.newConfigName.set('');
    }
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  protected createConfig(): void {
    const name = this.newConfigName().trim();
    if (!name) {
      this.errorMessage.set(this.translate.instant('webhook.googleLeads.errors.nameRequired'));
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.createdConfig.set(null);
    this.keyCopied.set(false);
    this.urlCopied.set(false);

    this.webhookService
      .createGoogleConfig({ name })
      .pipe(
        catchError(error => {
          this.errorMessage.set(this.normalizeError(error));
          return EMPTY;
        }),
        finalize(() => this.isSaving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(response => {
        this.createdConfig.set(response);
        this.showCreateForm.set(false);
        this.newConfigName.set('');
        this.loadConfigs();
      });
  }

  // ---- Mapping ----

  protected setMappingCampaignId(configId: string, value: string): void {
    this.updateMappingInput(configId, { campaignId: value });
  }

  protected setMappingServiceType(configId: string, value: string): void {
    this.updateMappingInput(configId, { serviceType: value });
  }

  protected addMapping(config: GoogleWebhookConfig): void {
    const mapping = this.getMappingInput(config.id);
    if (!mapping.campaignId.trim() || !mapping.serviceType.trim()) {
      this.errorMessage.set(this.translate.instant('webhook.googleLeads.errors.mappingRequired'));
      return;
    }

    const payload: UpdateGoogleCampaignMappingRequest = {
      campaignId: mapping.campaignId.trim(),
      serviceType: mapping.serviceType.trim(),
    };

    this.isSaving.set(true);
    this.errorMessage.set('');

    this.webhookService
      .updateGoogleCampaignMapping(config.id, payload)
      .pipe(
        catchError(error => {
          this.errorMessage.set(this.normalizeError(error));
          return EMPTY;
        }),
        finalize(() => this.isSaving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.configs.update(list =>
          list.map(item =>
            item.id === config.id
              ? {
                  ...item,
                  campaignMappings: {
                    ...item.campaignMappings,
                    [payload.campaignId]: payload.serviceType,
                  },
                }
              : item,
          ),
        );
        this.updateMappingInput(config.id, { campaignId: '', serviceType: '' });
        this.successMessage.set(this.translate.instant('webhook.googleLeads.mappingSaved'));
      });
  }

  protected mappingEntries(config: GoogleWebhookConfig): { campaignId: string; serviceType: string }[] {
    return Object.entries(config.campaignMappings || {}).map(([campaignId, serviceType]) => ({
      campaignId,
      serviceType,
    }));
  }

  protected confirmMappingDelete(configId: string, campaignId: string): void {
    this.mappingDeleteTarget.set({ configId, campaignId });
  }

  protected cancelMappingDelete(): void {
    this.mappingDeleteTarget.set(null);
  }

  protected executeMappingDelete(): void {
    const target = this.mappingDeleteTarget();
    if (!target) return;

    this.isSaving.set(true);
    this.errorMessage.set('');
    this.mappingDeleteTarget.set(null);

    this.webhookService
      .deleteGoogleCampaignMapping(target.configId, target.campaignId)
      .pipe(
        catchError(error => {
          this.errorMessage.set(this.normalizeError(error));
          return EMPTY;
        }),
        finalize(() => this.isSaving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.removeMappingFromConfig(target.configId, target.campaignId);
        this.successMessage.set(this.translate.instant('webhook.googleLeads.mappingDeleted'));
      });
  }

  private removeMappingFromConfig(configId: string, campaignId: string): void {
    this.configs.update(list =>
      list.map(item =>
        item.id === configId
          ? {
              ...item,
              campaignMappings: Object.fromEntries(
                Object.entries(item.campaignMappings || {}).filter(([key]) => key !== campaignId),
              ),
            }
          : item,
      ),
    );
  }

  // ---- Delete ----

  protected confirmDelete(config: GoogleWebhookConfig): void {
    this.deleteTarget.set(config);
  }

  protected cancelDelete(): void {
    this.deleteTarget.set(null);
  }

  protected executeDelete(): void {
    const target = this.deleteTarget();
    if (!target) return;

    this.isSaving.set(true);
    this.errorMessage.set('');
    this.deleteTarget.set(null);

    this.webhookService
      .deleteGoogleConfig(target.id)
      .pipe(
        catchError(error => {
          this.errorMessage.set(this.normalizeError(error));
          return EMPTY;
        }),
        finalize(() => this.isSaving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.successMessage.set(this.translate.instant('webhook.googleLeads.deleted'));
        this.loadConfigs();
      });
  }

  // ---- Clipboard ----

  protected async copyGoogleKey(): Promise<void> {
    const key = this.createdConfig()?.googleKey;
    if (!key) return;
    await navigator.clipboard.writeText(key);
    this.keyCopied.set(true);
    setTimeout(() => this.keyCopied.set(false), 3000);
  }

  protected async copyWebhookUrl(): Promise<void> {
    const url = this.createdConfig()?.webhookUrl || this.googleWebhookUrl();
    await navigator.clipboard.writeText(url);
    this.urlCopied.set(true);
    setTimeout(() => this.urlCopied.set(false), 3000);
  }

  // ---- Helpers ----

  protected formatDate(value: string): string {
    const locale = this.lang().lang || 'nl';
    return formatDateValue(value, locale, { dateStyle: 'medium', timeStyle: 'short' });
  }

  protected dismissCreatedConfig(): void {
    this.createdConfig.set(null);
  }

  protected getMappingInput(configId: string): { campaignId: string; serviceType: string } {
    return this.mappingInputs()[configId] ?? { campaignId: '', serviceType: '' };
  }

  private updateMappingInput(configId: string, patch: Partial<{ campaignId: string; serviceType: string }>): void {
    this.mappingInputs.update(inputs => ({
      ...inputs,
      [configId]: {
        ...(inputs[configId] ?? { campaignId: '', serviceType: '' }),
        ...patch,
      },
    }));
  }

  private normalizeError(error: unknown): string {
    const message = this.extractErrorMessage(error);
    if (message) return message;
    return this.translate.instant('webhook.googleLeads.errors.generic');
  }

  private extractErrorMessage(error: unknown): string | null {
    if (typeof error === 'string') return error;
    if (!error || typeof error !== 'object') return null;

    const err = error as Record<string, unknown>;
    return this.extractNestedError(err) ?? this.extractMessageField(err);
  }

  private extractNestedError(err: Record<string, unknown>): string | null {
    if (!('error' in err)) return null;
    const nested = err['error'];
    if (typeof nested === 'string') return nested;
    if (!nested || typeof nested !== 'object') return null;

    const nestedObj = nested as Record<string, unknown>;
    const msg = nestedObj['error'];
    return typeof msg === 'string' ? msg : null;
  }

  private extractMessageField(err: Record<string, unknown>): string | null {
    const msg = err['message'];
    return typeof msg === 'string' ? msg : null;
  }
}
