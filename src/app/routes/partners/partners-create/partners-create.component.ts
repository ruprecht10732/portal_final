import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { PartnersService } from '../../../core/services/partners.service';
import { ErrorReportingService } from '../../../core/services/error-reporting.service';
import { extractErrorMessage } from '../../../core/utils/error-utils';
import type { CreatePartnerRequest } from '../../../core/services/partners.types';
import { InputComponent } from '../../../shared/components/input/input.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';

const KVK_PATTERN = /^[0-9]{8}$/;
const VAT_PATTERN = /^NL[0-9]{9}B[0-9]{2}$/i;
const MAX_LENGTHS = {
  businessName: 200,
  kvkNumber: 20,
  vatNumber: 20,
  addressLine1: 200,
  addressLine2: 200,
  postalCode: 20,
  city: 120,
  country: 120,
  contactName: 120,
  contactPhone: 50,
} as const;

@Component({
  selector: 'app-partners-create',
  templateUrl: './partners-create.component.html',
  styleUrl: './partners-create.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    InputComponent,
    ButtonComponent,
    PageHeaderComponent,
    TranslatePipe,
  ],
})
export class PartnersCreateComponent {
  private readonly partnersService = inject(PartnersService);
  private readonly reporter = inject(ErrorReportingService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly submitAttempted = signal(false);

  protected readonly form = this.fb.group({
    businessName: ['', [Validators.required, Validators.maxLength(MAX_LENGTHS.businessName)]],
    kvkNumber: ['', [
      Validators.required,
      Validators.maxLength(MAX_LENGTHS.kvkNumber),
      Validators.pattern(KVK_PATTERN),
    ]],
    vatNumber: ['', [
      Validators.required,
      Validators.maxLength(MAX_LENGTHS.vatNumber),
      Validators.pattern(VAT_PATTERN),
    ]],
    contactName: ['', [Validators.required, Validators.maxLength(MAX_LENGTHS.contactName)]],
    contactEmail: ['', [Validators.required, Validators.email]],
    contactPhone: ['', [Validators.required, Validators.maxLength(MAX_LENGTHS.contactPhone)]],
    addressLine1: ['', [Validators.required, Validators.maxLength(MAX_LENGTHS.addressLine1)]],
    addressLine2: ['', [Validators.maxLength(MAX_LENGTHS.addressLine2)]],
    postalCode: ['', [Validators.required, Validators.maxLength(MAX_LENGTHS.postalCode)]],
    city: ['', [Validators.required, Validators.maxLength(MAX_LENGTHS.city)]],
    country: ['NL', [Validators.required, Validators.maxLength(MAX_LENGTHS.country)]],
  });

  protected readonly requiredError = computed(() => this.translate.instant('partners.form.validation.required'));
  protected readonly emailError = computed(() => this.translate.instant('partners.form.validation.invalidEmail'));
  protected readonly invalidKvkError = computed(() => this.translate.instant('partners.form.validation.invalidKvk'));
  protected readonly invalidVatError = computed(() => this.translate.instant('partners.form.validation.invalidVat'));

  protected save(): void {
    this.submitAttempted.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;

    this.saving.set(true);
    this.error.set(null);

    const values = this.form.getRawValue();
    const request: CreatePartnerRequest = {
      businessName: (values.businessName ?? '').trim(),
      kvkNumber: (values.kvkNumber ?? '').trim(),
      vatNumber: (values.vatNumber ?? '').trim().toUpperCase(),
      contactName: (values.contactName ?? '').trim(),
      contactEmail: (values.contactEmail ?? '').trim(),
      contactPhone: (values.contactPhone ?? '').trim(),
      addressLine1: (values.addressLine1 ?? '').trim(),
      ...(values.addressLine2?.trim() ? { addressLine2: values.addressLine2.trim() } : {}),
      postalCode: (values.postalCode ?? '').trim(),
      city: (values.city ?? '').trim(),
      country: (values.country ?? '').trim(),
    };

    this.partnersService.create(request).subscribe({
      next: () => this.router.navigate(['/app/partners']),
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant('partners.form.errors.createFailed'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.saving.set(false);
      },
    });
  }

  protected cancel(): void {
    this.router.navigate(['/app/partners']);
  }

  protected controlError(
    controlName: keyof typeof this.form.controls,
    options: { maxLength?: number; patternError?: string } = {},
  ): string {
    if (!this.submitAttempted()) return '';
    const control = this.form.controls[controlName];
    if (!control) return '';
    if (control.hasError('required')) return this.requiredError();
    if (control.hasError('maxlength') && options.maxLength) {
      return this.translate.instant('partners.form.validation.maxLength', { max: options.maxLength });
    }
    if (control.hasError('pattern') && options.patternError) return options.patternError;
    return '';
  }

  protected optionalControlError(controlName: keyof typeof this.form.controls, maxLength: number): string {
    if (!this.submitAttempted()) return '';
    const control = this.form.controls[controlName];
    if (!control) return '';
    if (control.hasError('maxlength')) {
      return this.translate.instant('partners.form.validation.maxLength', { max: maxLength });
    }
    return '';
  }

  protected emailControlError(): string {
    if (!this.submitAttempted()) return '';
    const control = this.form.controls.contactEmail;
    if (control.hasError('required')) return this.requiredError();
    if (control.hasError('email')) return this.emailError();
    return '';
  }
}
