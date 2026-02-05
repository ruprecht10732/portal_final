import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, filter, map, of, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PartnersService } from '../../../core/services/partners.service';
import { ServiceTypesService } from '../../../core/services/service-types.service';
import { ErrorReportingService } from '../../../core/services/error-reporting.service';
import { extractErrorMessage } from '../../../core/utils/error-utils';
import { KVK_REGEX, VAT_REGEX } from '../../../core/utils/partner-validation.util';
import { AddressService, type AddressSuggestion } from '../../../core/services/address.service';
import type { CreatePartnerRequest, Partner } from '../../../core/services/partners.types';
import { InputComponent } from '../../../shared/components/input/input.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { MultiSelectComponent, type MultiSelectOption } from '../../../shared/components/multiselect/multiselect.component';
import { FileUploaderComponent, type PresignedUpload } from '../../../shared/components/file-uploader/file-uploader.component';
import type { ServiceTypeItem } from '../../../core/services/service-types.types';
import { AutocompleteComponent, type AutocompleteOption } from '../../../shared/components/autocomplete/autocomplete.component';
import { DEBOUNCE_MS, MIN_LENGTH } from '../../../core/config';

const MAX_LENGTHS = {
  businessName: 200,
  kvkNumber: 20,
  vatNumber: 20,
  addressLine1: 200,
  houseNumber: 20,
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
    AutocompleteComponent,
    MultiSelectComponent,
    FileUploaderComponent,
    TranslatePipe,
  ],
})
export class PartnersCreateComponent implements OnInit {
  private readonly partnersService = inject(PartnersService);
  private readonly serviceTypesService = inject(ServiceTypesService);
  private readonly reporter = inject(ErrorReportingService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly addressService = inject(AddressService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly createdPartner = signal<Partner | null>(null);
  protected readonly logoDownloadUrl = signal<string | null>(null);
  protected readonly logoLoading = signal(false);
  protected readonly logoError = signal<string | null>(null);
  protected readonly logoImageError = signal(false);
  protected readonly serviceTypes = signal<ServiceTypeItem[]>([]);
  protected readonly serviceTypesLoading = signal(false);
  protected readonly serviceTypesError = signal<string | null>(null);
  protected readonly submitAttempted = signal(false);
  protected readonly addressOptions = signal<AutocompleteOption[]>([]);
  private readonly addressSuggestions = signal<AddressSuggestion[]>([]);

  protected readonly form = this.fb.group({
    businessName: ['', [Validators.required, Validators.maxLength(MAX_LENGTHS.businessName)]],
    kvkNumber: ['', [
      Validators.required,
      Validators.maxLength(MAX_LENGTHS.kvkNumber),
      Validators.pattern(KVK_REGEX),
    ]],
    vatNumber: ['', [
      Validators.required,
      Validators.maxLength(MAX_LENGTHS.vatNumber),
      Validators.pattern(VAT_REGEX),
    ]],
    contactName: ['', [Validators.required, Validators.maxLength(MAX_LENGTHS.contactName)]],
    contactEmail: ['', [Validators.required, Validators.email]],
    contactPhone: ['', [Validators.required, Validators.maxLength(MAX_LENGTHS.contactPhone)]],
    addressLine1: ['', [Validators.required, Validators.maxLength(MAX_LENGTHS.addressLine1)]],
    houseNumber: ['', [Validators.required, Validators.maxLength(MAX_LENGTHS.houseNumber)]],
    addressLine2: ['', [Validators.maxLength(MAX_LENGTHS.addressLine2)]],
    postalCode: ['', [Validators.required, Validators.maxLength(MAX_LENGTHS.postalCode)]],
    city: ['', [Validators.required, Validators.maxLength(MAX_LENGTHS.city)]],
    country: ['NL', [Validators.required, Validators.maxLength(MAX_LENGTHS.country)]],
    latitude: this.fb.control<number | null>(null),
    longitude: this.fb.control<number | null>(null),
    serviceTypeIds: this.fb.control<string[]>([]),
  });

  protected readonly requiredError = computed(() => this.translate.instant('partners.form.validation.required'));
  protected readonly emailError = computed(() => this.translate.instant('partners.form.validation.invalidEmail'));
  protected readonly invalidKvkError = computed(() => this.translate.instant('partners.form.validation.invalidKvk'));
  protected readonly invalidVatError = computed(() => this.translate.instant('partners.form.validation.invalidVat'));
  protected readonly serviceTypeOptions = computed<MultiSelectOption<string>[]>(() => (
    this.serviceTypes().map(item => ({ label: item.name, value: item.id }))
  ));
  protected readonly logoPreviewUrl = computed(() => {
    return this.logoDownloadUrl();
  });
  protected readonly logoInitials = computed(() => {
    const name = this.createdPartner()?.businessName || this.form.controls.businessName.value || '';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'P';
    const first = parts[0] ?? '';
    if (parts.length === 1) return (first.slice(0, 2) || 'P').toUpperCase();
    const initials = `${first[0] ?? ''}${parts[1]?.[0] ?? ''}`.trim();
    return (initials || first.slice(0, 2) || 'P').toUpperCase();
  });

  ngOnInit(): void {
    this.loadServiceTypes();
    this.setupAddressSearch();
  }

  protected save(): void {
    this.submitAttempted.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving() || this.createdPartner()) return;

    this.saving.set(true);
    this.error.set(null);

    const values = this.form.getRawValue();
    const serviceTypeIds = values.serviceTypeIds ?? [];
    const request: CreatePartnerRequest = {
      businessName: (values.businessName ?? '').trim(),
      kvkNumber: (values.kvkNumber ?? '').trim(),
      vatNumber: (values.vatNumber ?? '').trim().toUpperCase(),
      contactName: (values.contactName ?? '').trim(),
      contactEmail: (values.contactEmail ?? '').trim(),
      contactPhone: (values.contactPhone ?? '').trim(),
      addressLine1: (values.addressLine1 ?? '').trim(),
      houseNumber: (values.houseNumber ?? '').trim(),
      ...(values.addressLine2?.trim() ? { addressLine2: values.addressLine2.trim() } : {}),
      postalCode: (values.postalCode ?? '').trim(),
      city: (values.city ?? '').trim(),
      country: (values.country ?? '').trim(),
      ...(values.latitude !== null && { latitude: values.latitude }),
      ...(values.longitude !== null && { longitude: values.longitude }),
      ...(serviceTypeIds.length > 0 ? { serviceTypeIds } : {}),
    };

    this.partnersService.create(request).subscribe({
      next: (partner) => {
        this.createdPartner.set(partner);
        this.form.disable();
        this.saving.set(false);
        this.loadLogoDownloadUrl(partner);
      },
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

  protected goToEdit(): void {
    const partner = this.createdPartner();
    if (!partner) return;
    this.router.navigate(['/app/partners', partner.id, 'edit']);
  }

  protected presignLogo = async (file: File): Promise<PresignedUpload> => {
    const partner = this.createdPartner();
    if (!partner) {
      throw new Error(this.translate.instant('partners.form.logoUnavailable'));
    }

    const response = await firstValueFrom(this.partnersService.presignLogo(partner.id, {
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
    }));

    if (!response) {
      throw new Error(this.translate.instant('partners.form.errors.logoUploadFailed'));
    }

    return { uploadUrl: response.uploadUrl, fileKey: response.fileKey };
  };

  protected finalizeLogo = async (file: File, presigned: PresignedUpload): Promise<unknown> => {
    const partner = this.createdPartner();
    if (!partner) {
      throw new Error(this.translate.instant('partners.form.logoUnavailable'));
    }

    const updated = await firstValueFrom(this.partnersService.setLogo(partner.id, {
      fileKey: presigned.fileKey,
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
    }));

    if (!updated) {
      throw new Error(this.translate.instant('partners.form.errors.logoUploadFailed'));
    }

    this.createdPartner.set(updated);
    this.loadLogoDownloadUrl(updated);
    return updated;
  };

  protected onAddressLine1Change(value: string): void {
    this.form.controls.addressLine1.setValue(value);

    const match = this.addressSuggestions().find(suggestion => suggestion.label === value);
    if (match) {
      this.applyAddressSuggestion(match);
      return;
    }

    this.clearCoordinates();
  }

  protected onPostalCodeChange(value: string): void {
    this.form.controls.postalCode.setValue(value);
    this.clearCoordinates();
  }

  protected onHouseNumberChange(value: string): void {
    this.form.controls.houseNumber.setValue(value);
    this.clearCoordinates();
  }

  protected onCityChange(value: string): void {
    this.form.controls.city.setValue(value);
    this.clearCoordinates();
  }

  protected onCountryChange(value: string): void {
    this.form.controls.country.setValue(value);
    this.clearCoordinates();
  }

  private loadServiceTypes(): void {
    this.serviceTypesLoading.set(true);
    this.serviceTypesError.set(null);
    this.serviceTypesService.listActive().subscribe({
      next: response => {
        this.serviceTypes.set(response.items ?? []);
        this.serviceTypesLoading.set(false);
      },
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant('partners.form.errors.loadServiceTypes'));
        this.serviceTypesError.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.serviceTypesLoading.set(false);
      },
    });
  }

  private setupAddressSearch(): void {
    this.form.controls.addressLine1.valueChanges.pipe(
      map(value => (value ?? '').trim()),
      filter(value => value.length >= MIN_LENGTH.address),
      debounceTime(DEBOUNCE_MS.search),
      distinctUntilChanged(),
      switchMap(query => this.addressService.search(query).pipe(
        catchError((err) => {
          this.reporter.report(err, {
            source: 'http',
            silent: true,
            userMessage: this.translate.instant('partners.form.errors.searchAddresses'),
          });
          return of([]);
        })
      )),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(results => {
      this.addressSuggestions.set(results);
      this.addressOptions.set(results.map(addr => ({
        label: addr.label,
        value: addr.label,
      })));
    });
  }

  private applyAddressSuggestion(suggestion: AddressSuggestion): void {
    this.form.patchValue({
      addressLine1: suggestion.street ?? suggestion.label ?? '',
      houseNumber: suggestion.houseNumber ?? '',
      postalCode: suggestion.zipCode ?? '',
      city: suggestion.city ?? '',
      country: suggestion.country ?? '',
      latitude: this.parseCoordinate(suggestion.lat),
      longitude: this.parseCoordinate(suggestion.lon),
    });
  }

  private clearCoordinates(): void {
    this.form.patchValue({
      latitude: null,
      longitude: null,
    });
  }

  private parseCoordinate(value?: string): number | null {
    if (!value) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private loadLogoDownloadUrl(partner: Partner): void {
    if (!partner.logoFileKey) {
      this.logoDownloadUrl.set(null);
      return;
    }

    this.logoLoading.set(true);
    this.logoError.set(null);

    this.partnersService.getLogoDownloadUrl(partner.id).subscribe({
      next: (response) => {
        this.logoDownloadUrl.set(response.downloadUrl);
        this.logoImageError.set(false);
        this.logoLoading.set(false);
      },
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant('partners.form.errors.logoLoadFailed'));
        this.logoError.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.logoLoading.set(false);
      },
    });
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
