import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ErrorReportingService } from '../../../core/services/error-reporting.service';
import { ServiceTypesService } from '../../../core/services/service-types.service';
import type { CreateServiceTypeRequest } from '../../../core/services/service-types.types';
import { normalizeIconName } from '../../../core/services/icon-utils';
import { InputComponent } from '../../../shared/components/input/input.component';
import { TextareaComponent } from '../../../shared/components/textarea/textarea.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { IconPickerComponent } from '../../../shared/components/icon-picker/icon-picker.component';
import { ColorPickerComponent } from '../../../shared/components/color-picker/color-picker.component';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-service-type-create',
  templateUrl: './service-type-create.component.html',
  styleUrl: './service-type-create.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    InputComponent,
    TextareaComponent,
    ButtonComponent,
    IconPickerComponent,
    ColorPickerComponent,
    LucideAngularModule,
    TranslatePipe,
  ],
})
export class ServiceTypeCreateComponent {
  private readonly serviceTypesService = inject(ServiceTypesService);
  private readonly reporter = inject(ErrorReportingService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  protected readonly name = signal('');
  protected readonly description = signal('');
  protected readonly intakeGuidelines = signal('');
  protected readonly icon = signal('');
  protected readonly color = signal('');
  protected readonly displayOrder = signal('0');

  protected readonly creating = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly canCreate = computed(() => this.name().trim().length > 0);

  protected createServiceType(): void {
    if (!this.canCreate() || this.creating()) return;

    this.creating.set(true);
    this.error.set(null);

    const displayOrderValue = this.parseDisplayOrder(this.displayOrder());
    const normalizedIcon = normalizeIconName(this.normalizeOptional(this.icon()));
    const request: CreateServiceTypeRequest = {
      name: this.name().trim(),
      description: this.normalizeOptional(this.description()),
      intakeGuidelines: this.normalizeOptional(this.intakeGuidelines()),
      icon: normalizedIcon ?? undefined,
      color: this.normalizeOptional(this.color()),
      displayOrder: displayOrderValue,
    };

    this.serviceTypesService.create(request).subscribe({
      next: () => {
        this.resetForm();
        this.router.navigate(['/app/services']);
      },
      error: (err) => {
        const message = this.getErrorMessage(err, this.translate.instant('services.errors.createFailed'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.creating.set(false);
      },
    });
  }

  protected resetForm(): void {
    this.name.set('');
    this.description.set('');
    this.intakeGuidelines.set('');
    this.icon.set('');
    this.color.set('');
    this.displayOrder.set('0');
    this.creating.set(false);
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

  private parseDisplayOrder(value: unknown): number | undefined {
    if (value === null || value === undefined || value === '') return undefined;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return undefined;
    return parsed;
  }

  private getErrorMessage(error: unknown, fallback: string): string {
    if (error && typeof error === 'object' && 'error' in error) {
      const nested = (error as { error?: { error?: string } | string }).error;
      if (typeof nested === 'string') return nested;
      if (nested && typeof nested === 'object' && 'error' in nested && typeof nested.error === 'string') {
        return nested.error;
      }
    }
    return fallback;
  }
}
