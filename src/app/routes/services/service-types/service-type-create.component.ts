import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ErrorReportingService } from '../../../core/services/error-reporting.service';
import { ServiceTypesService } from '../../../core/services/service-types.service';
import type { CreateServiceTypeRequest } from '../../../core/services/service-types.types';
import { normalizeIconName } from '../../../core/services/icon-utils';
import { extractErrorMessage } from '../../../core/utils/error-utils';
import { InputComponent } from '../../../shared/components/input/input.component';
import { TextareaComponent } from '../../../shared/components/textarea/textarea.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { IconPickerComponent } from '../../../shared/components/icon-picker/icon-picker.component';
import { ColorPickerComponent } from '../../../shared/components/color-picker/color-picker.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';

@Component({
  selector: 'app-service-type-create',
  templateUrl: './service-type-create.component.html',
  styleUrl: './service-type-create.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    InputComponent,
    TextareaComponent,
    ButtonComponent,
    IconPickerComponent,
    ColorPickerComponent,
    PageHeaderComponent,
    TranslatePipe,
  ],
  host: { class: 'xl:flex xl:flex-col xl:flex-1 xl:min-h-0 xl:overflow-y-auto' },
})
export class ServiceTypeCreateComponent {
  private readonly serviceTypesService = inject(ServiceTypesService);
  private readonly reporter = inject(ErrorReportingService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  protected readonly name = signal('');
  protected readonly description = signal('');
  protected readonly intakeGuidelines = signal('');
  protected readonly estimationGuidelines = signal('');
  protected readonly icon = signal('');
  protected readonly color = signal('');

  protected readonly creating = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly canCreate = computed(() => this.name().trim().length > 0);

  protected createServiceType(): void {
    if (!this.canCreate() || this.creating()) return;

    this.creating.set(true);
    this.error.set(null);

    const normalizedIcon = normalizeIconName(this.normalizeOptional(this.icon()));
    const description = this.normalizeOptional(this.description());
    const intakeGuidelines = this.normalizeOptional(this.intakeGuidelines());
    const estimationGuidelines = this.normalizeOptional(this.estimationGuidelines());
    const icon = normalizedIcon ?? undefined;
    const color = this.normalizeOptional(this.color());
    const request: CreateServiceTypeRequest = {
      name: this.name().trim(),
      ...(description !== undefined && { description }),
      ...(intakeGuidelines !== undefined && { intakeGuidelines }),
      ...(estimationGuidelines !== undefined && { estimationGuidelines }),
      ...(icon !== undefined && { icon }),
      ...(color !== undefined && { color }),
    };

    this.serviceTypesService.create(request).subscribe({
      next: () => {
        this.resetForm();
        this.router.navigate(['/app/settings/services']);
      },
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant('services.errors.createFailed'));
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
    this.estimationGuidelines.set('');
    this.icon.set('');
    this.color.set('');
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

}
