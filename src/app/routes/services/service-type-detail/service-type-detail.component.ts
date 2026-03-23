import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { forkJoin, Observable, switchMap } from 'rxjs';
import { ServiceTypesService } from '../../../core/services/service-types.service';
import type { ServiceTypeItem, UpdateServiceTypeRequest } from '../../../core/services/service-types.types';
import { ErrorReportingService } from '../../../core/services/error-reporting.service';
import { ToastService } from '../../../core/services/toast.service';
import { extractErrorMessage } from '../../../core/utils/error-utils';
import { normalizeIconName } from '../../../core/services/icon-utils';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { CheckboxComponent } from '../../../shared/components/checkbox/checkbox.component';
import { ColorPickerComponent } from '../../../shared/components/color-picker/color-picker.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { IconPickerComponent } from '../../../shared/components/icon-picker/icon-picker.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { MarkdownPipe } from '../../../shared/pipes/markdown.pipe';
import { TextareaComponent } from '../../../shared/components/textarea/textarea.component';

@Component({
  selector: 'app-service-type-detail',
  imports: [
    DatePipe,
    TranslatePipe,
    LucideAngularModule,
    ButtonComponent,
    CheckboxComponent,
    ColorPickerComponent,
    ConfirmDialogComponent,
    IconPickerComponent,
    InputComponent,
    MarkdownPipe,
    PageHeaderComponent,
    TextareaComponent,
  ],
  templateUrl: './service-type-detail.component.html',
  styleUrl: './service-type-detail.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'xl:flex xl:flex-col xl:flex-1 xl:min-h-0 xl:overflow-hidden' },
})
export class ServiceTypeDetailComponent implements OnInit {
  private readonly serviceTypesService = inject(ServiceTypesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly reporter = inject(ErrorReportingService);
  private readonly translate = inject(TranslateService);
  private readonly toast = inject(ToastService);

  protected readonly serviceType = signal<ServiceTypeItem | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly deleting = signal(false);
  protected readonly saving = signal(false);
  protected readonly showDeleteDialog = signal(false);

  protected readonly name = signal('');
  protected readonly description = signal('');
  protected readonly intakeGuidelines = signal('');
  protected readonly estimationGuidelines = signal('');
  protected readonly icon = signal('');
  protected readonly color = signal('');
  protected readonly isActiveDraft = signal(false);

  protected readonly isActive = computed(() => this.serviceType()?.isActive ?? false);
  protected readonly hasChanges = computed(() => {
    const item = this.serviceType();
    if (!item) return false;

    return this.normalizeName(this.name()) !== item.name
      || this.normalizeNullable(this.description()) !== (item.description ?? null)
      || this.normalizeNullable(this.intakeGuidelines()) !== (item.intakeGuidelines ?? null)
      || this.normalizeNullable(this.estimationGuidelines()) !== (item.estimationGuidelines ?? null)
      || this.normalizeIcon(this.icon()) !== (item.icon ?? null)
      || this.normalizeNullable(this.color()) !== (item.color ?? null)
      || this.isActiveDraft() !== item.isActive;
  });
  protected readonly canSave = computed(() => {
    if (this.loading() || this.saving()) return false;
    if (!this.serviceType()) return false;
    if (this.normalizeName(this.name()).length === 0) return false;
    return this.hasChanges();
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadServiceType(id);
    } else {
      this.loading.set(false);
      this.error.set(this.translate.instant('services.errors.loadFailed'));
    }
  }

  private loadServiceType(id: string): void {
    this.loading.set(true);
    this.serviceTypesService.getById(id).subscribe({
      next: (item) => {
        this.serviceType.set(item);
        this.hydrateForm(item);
        this.error.set(null);
        this.loading.set(false);
      },
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant('services.errors.loadFailed'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.loading.set(false);
      },
    });
  }

  protected goBack(): void {
    this.router.navigate(['/app/settings/services']);
  }

  protected openDeleteDialog(): void {
    this.showDeleteDialog.set(true);
  }

  protected closeDeleteDialog(): void {
    this.showDeleteDialog.set(false);
  }

  protected resetForm(): void {
    const item = this.serviceType();
    if (!item) return;
    this.hydrateForm(item);
    this.error.set(null);
  }

  protected saveChanges(): void {
    const item = this.serviceType();
    if (!item || !this.canSave()) return;

    const updateRequest = this.buildUpdateRequest(item);
    const requests: Record<string, Observable<unknown>> = {};

    if (Object.keys(updateRequest).length > 0) {
      requests['update'] = this.serviceTypesService.update(item.id, updateRequest);
    }

    if (this.isActiveDraft() !== item.isActive) {
      requests['toggleActive'] = this.serviceTypesService.toggleActive(item.id);
    }

    if (Object.keys(requests).length === 0) return;

    this.saving.set(true);
    this.error.set(null);

    forkJoin(requests).pipe(
      switchMap(() => this.serviceTypesService.getById(item.id)),
    ).subscribe({
      next: (updated) => {
        this.serviceType.set(updated);
        this.hydrateForm(updated);
        this.saving.set(false);
        this.toast.success(this.translate.instant('services.detail.saveSuccess'));
      },
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant('services.errors.saveFailed'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.saving.set(false);
      },
    });
  }

  protected confirmDelete(): void {
    const item = this.serviceType();
    if (!item || this.deleting()) return;

    this.deleting.set(true);
    this.serviceTypesService.delete(item.id).subscribe({
      next: () => {
        this.toast.success(this.translate.instant('services.detail.deleteSuccess'));
        this.router.navigate(['/app/settings/services']);
      },
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant('services.errors.deleteFailed'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.deleting.set(false);
        this.closeDeleteDialog();
      },
    });
  }

  private hydrateForm(item: ServiceTypeItem): void {
    this.name.set(item.name);
    this.description.set(item.description ?? '');
    this.intakeGuidelines.set(item.intakeGuidelines ?? '');
    this.estimationGuidelines.set(item.estimationGuidelines ?? '');
    this.icon.set(item.icon ?? '');
    this.color.set(item.color ?? '');
    this.isActiveDraft.set(item.isActive);
  }

  private buildUpdateRequest(item: ServiceTypeItem): UpdateServiceTypeRequest {
    const request: UpdateServiceTypeRequest = {};
    const name = this.normalizeName(this.name());
    const description = this.normalizeNullable(this.description());
    const intakeGuidelines = this.normalizeNullable(this.intakeGuidelines());
    const estimationGuidelines = this.normalizeNullable(this.estimationGuidelines());
    const icon = this.normalizeIcon(this.icon());
    const color = this.normalizeNullable(this.color());

    if (name && name !== item.name) {
      request.name = name;
    }
    if (description !== (item.description ?? null)) {
      request.description = description;
    }
    if (intakeGuidelines !== (item.intakeGuidelines ?? null)) {
      request.intakeGuidelines = intakeGuidelines;
    }
    if (estimationGuidelines !== (item.estimationGuidelines ?? null)) {
      request.estimationGuidelines = estimationGuidelines;
    }
    if (icon !== (item.icon ?? null)) {
      request.icon = icon;
    }
    if (color !== (item.color ?? null)) {
      request.color = color;
    }

    return request;
  }

  private normalizeOptional(value: unknown): string | undefined {
    if (value === null || value === undefined) return undefined;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
    return undefined;
  }

  private normalizeName(value: unknown): string {
    return this.normalizeOptional(value) ?? '';
  }

  private normalizeNullable(value: unknown): string | null {
    return this.normalizeOptional(value) ?? null;
  }

  private normalizeIcon(value: unknown): string | null {
    return normalizeIconName(this.normalizeOptional(value)) ?? null;
  }

}
