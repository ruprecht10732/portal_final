import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, debounceTime, distinctUntilChanged, filter, map, of, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AddressService, type AddressSuggestion } from '../../../core/services/address.service';
import { ErrorReportingService } from '../../../core/services/error-reporting.service';
import { LeadsService } from '../../../core/services/leads.service';
import { OrganizationService, type WhatsAppStatus } from '../../../core/services/organization.service';
import { ServiceTypesService } from '../../../core/services/service-types.service';
import type { ServiceTypeItem } from '../../../core/services/service-types.types';
import type { Lead, ConsumerRole, CreateLeadRequest, UpdateLeadRequest } from '../../../core/services/leads.types';
import { CheckboxComponent } from '../../../shared/components/checkbox/checkbox.component';
import { CONSUMER_ROLE_OPTIONS } from '../../../core/services/leads.types';
import { extractErrorMessage } from '../../../core/utils/error-utils';
import { normalizePhoneE164 } from '../../../core/utils/phone.util';
import { AutocompleteComponent, type AutocompleteOption } from '../../../shared/components/autocomplete/autocomplete.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { SelectComponent, type SelectOption } from '../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../shared/components/textarea/textarea.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { phoneValidator } from '../../../shared/validators/phone.validator';
import { DEBOUNCE_MS, MIN_LENGTH, MAX_LENGTH } from '../../../core/config';

@Component({
  selector: 'app-lead-form',
  templateUrl: './lead-form.component.html',
  styleUrl: './lead-form.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ButtonComponent, InputComponent, SelectComponent, AutocompleteComponent, TextareaComponent, PageHeaderComponent, TranslatePipe, LucideAngularModule, ReactiveFormsModule, CheckboxComponent],
})
export class LeadFormComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly leadsService = inject(LeadsService);
  private readonly serviceTypesService = inject(ServiceTypesService);
  private readonly addressService = inject(AddressService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reporter = inject(ErrorReportingService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(FormBuilder);
  private readonly orgService = inject(OrganizationService);

  private readonly trackingData = signal<Partial<CreateLeadRequest>>({});
  private readonly trackingStorageKey = 'lead_tracking';

  protected readonly lead = signal<Lead | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly isNew = signal(true);
  protected readonly duplicateWarning = signal<Lead | null>(null);
  protected readonly submitAttempted = signal(false);
  protected readonly whatsAppStatus = signal<WhatsAppStatus | null>(null);
  protected readonly isWhatsAppConfigured = computed(() => this.whatsAppStatus()?.canSend ?? false);

  protected readonly form = this.fb.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    phone: ['', [Validators.required, phoneValidator()]],
    email: [''],
    consumerRole: this.fb.control<ConsumerRole>('Owner', { nonNullable: true }),
    whatsappOptedIn: this.fb.control(true),
    source: [''],
    consumerNote: [''],
    street: ['', Validators.required],
    houseNumber: ['', Validators.required],
    zipCode: ['', Validators.required],
    city: ['', Validators.required],
    serviceType: ['', Validators.required],
    latitude: this.fb.control<number | null>(null),
    longitude: this.fb.control<number | null>(null),
  });

  protected readonly sourceMaxLength = MAX_LENGTH.source;
  protected readonly consumerNoteMaxLength = MAX_LENGTH.consumerNote;

  protected readonly addressOptions = signal<AutocompleteOption[]>([]);
  private readonly addressSuggestions = signal<AddressSuggestion[]>([]);
  protected readonly serviceTypes = signal<ServiceTypeItem[]>([]);

  protected readonly serviceTypeOptions = computed<SelectOption<string>[]>(() =>
    this.serviceTypes().map(item => ({
      label: item.name,
      value: item.name,
    }))
  );
  protected readonly consumerRoleOptions = computed<SelectOption<ConsumerRole>[]>(() => CONSUMER_ROLE_OPTIONS);

  protected readonly requiredError = computed(() => this.translate.instant('leads.form.validation.required'));
  protected readonly invalidPhoneError = computed(() => this.translate.instant('leads.form.validation.invalidPhone'));

  protected setConsumerRole(value: ConsumerRole | null): void {
    if (value) this.form.controls.consumerRole.setValue(value);
  }

  protected setServiceType(value: string | null): void {
    if (value) this.form.controls.serviceType.setValue(value);
  }

  constructor() {
    this.setupAddressSearch();
  }

  ngOnInit(): void {
    this.loadServiceTypes();
    this.loadWhatsAppStatus();
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.isNew.set(false);
      this.loadLead(id);
    } else {
      this.captureTrackingData();
    }
  }

  private captureTrackingData(): void {
    const params = this.route.snapshot.queryParamMap;
    const gclid = params.get('gclid') ?? '';
    const utmSource = params.get('utm_source') ?? '';
    const utmMedium = params.get('utm_medium') ?? '';
    const utmCampaign = params.get('utm_campaign') ?? '';
    const utmContent = params.get('utm_content') ?? '';
    const utmTerm = params.get('utm_term') ?? '';
    const adLandingPage = globalThis.location.href;
    const referrerUrl = globalThis.document.referrer;

    let resolved = this.loadTrackingFromStorage();
    const fresh: Partial<CreateLeadRequest> = {};

    if (gclid) fresh.gclid = gclid;
    if (utmSource) fresh.utmSource = utmSource;
    if (utmMedium) fresh.utmMedium = utmMedium;
    if (utmCampaign) fresh.utmCampaign = utmCampaign;
    if (utmContent) fresh.utmContent = utmContent;
    if (utmTerm) fresh.utmTerm = utmTerm;

    const hasNewTracking = Object.keys(fresh).length > 0;

    if (hasNewTracking) {
      fresh.adLandingPage = adLandingPage;
      if (referrerUrl) fresh.referrerUrl = referrerUrl;
      resolved = fresh;
      this.storeTrackingData(resolved);
    } else if (resolved) {
      resolved = {
        ...resolved,
        adLandingPage,
        ...(referrerUrl ? { referrerUrl } : {}),
      };
    }

    if (resolved) {
      this.trackingData.set(resolved);
    }
  }

  private loadTrackingFromStorage(): Partial<CreateLeadRequest> | null {
    const raw = localStorage.getItem(this.trackingStorageKey);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as { expiresAt: number } & Partial<CreateLeadRequest>;
      if (!parsed.expiresAt || Date.now() > parsed.expiresAt) {
        localStorage.removeItem(this.trackingStorageKey);
        return null;
      }
      const { expiresAt: _expiresAt, ...data } = parsed;
      return data;
    } catch {
      localStorage.removeItem(this.trackingStorageKey);
      return null;
    }
  }

  private storeTrackingData(data: Partial<CreateLeadRequest>): void {
    const expiresAt = Date.now() + 90 * 24 * 60 * 60 * 1000;
    localStorage.setItem(this.trackingStorageKey, JSON.stringify({ ...data, expiresAt }));
  }

  private loadServiceTypes(): void {
    this.serviceTypesService.listActive().subscribe({
      next: (response) => {
        const items = response.items ?? [];
        this.serviceTypes.set(items);
        const firstItem = items[0];
        if (!this.form.controls.serviceType.value && firstItem) {
          this.form.controls.serviceType.setValue(firstItem.name);
        }
      },
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant('leads.form.errors.loadServiceTypes'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
      },
    });
  }

  private loadLead(id: string): void {
    this.loading.set(true);
    this.leadsService.getById(id).subscribe({
      next: (lead) => {
        this.lead.set(lead);
        this.populateForm(lead);
        this.loading.set(false);
      },
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant('leads.form.errors.loadLead'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.loading.set(false);
      },
    });
  }

  private loadWhatsAppStatus(): void {
    const fallbackStatus: WhatsAppStatus = {
      state: 'ERROR',
      message: '',
      canSend: false,
      needsReauth: false,
    };

    this.orgService.getWhatsAppStatus().pipe(
      catchError((err) => {
        this.reporter.report(err, { source: 'http', silent: true });
        return of(fallbackStatus);
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(status => {
      this.whatsAppStatus.set(status);
    });
  }

  private populateForm(lead: Lead): void {
    const fallbackServiceType = this.form.controls.serviceType.value || this.serviceTypes()[0]?.name || '';
    this.form.patchValue({
      firstName: lead.consumer.firstName,
      lastName: lead.consumer.lastName,
      phone: lead.consumer.phone,
      email: lead.consumer.email ?? '',
      consumerRole: lead.consumer.role,
      whatsappOptedIn: lead.whatsappOptedIn,
      source: this.clampValue(lead.source ?? '', this.sourceMaxLength),
      consumerNote: this.clampValue(lead.currentService?.consumerNote ?? '', this.consumerNoteMaxLength),
      street: lead.address.street,
      houseNumber: lead.address.houseNumber,
      zipCode: lead.address.zipCode,
      city: lead.address.city,
      latitude: lead.address.latitude ?? null,
      longitude: lead.address.longitude ?? null,
      serviceType: lead.currentService?.serviceType ?? fallbackServiceType,
    });
  }

  private setupAddressSearch(): void {
    this.form.controls.street.valueChanges.pipe(
      map(value => (value ?? '').trim()),
      filter(value => value.length >= MIN_LENGTH.address),
      debounceTime(DEBOUNCE_MS.search),
      distinctUntilChanged(),
      switchMap(query => this.addressService.search(query).pipe(
        catchError((err) => {
          this.reporter.report(err, {
            source: 'http',
            silent: true,
            userMessage: this.translate.instant('leads.form.errors.searchAddresses'),
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

  protected onStreetChange(value: string): void {
    this.form.controls.street.setValue(value);

    const match = this.addressSuggestions().find(suggestion => suggestion.label === value);
    if (match) {
      this.applyAddressSuggestion(match);
      return;
    }

    this.clearCoordinates();
  }

  protected onHouseNumberChange(value: string): void {
    this.form.controls.houseNumber.setValue(value);
    this.clearCoordinates();
  }

  protected onZipCodeChange(value: string): void {
    this.form.controls.zipCode.setValue(value);
    this.clearCoordinates();
  }

  protected onCityChange(value: string): void {
    this.form.controls.city.setValue(value);
    this.clearCoordinates();
  }

  private applyAddressSuggestion(suggestion: AddressSuggestion): void {
    this.form.patchValue({
      street: suggestion.street ?? '',
      houseNumber: suggestion.houseNumber ?? '',
      zipCode: suggestion.zipCode ?? '',
      city: suggestion.city ?? '',
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

  protected onSourceChange(value: string): void {
    this.form.controls.source.setValue(this.clampValue(value, this.sourceMaxLength));
  }

  protected onConsumerNoteChange(value: string): void {
    this.form.controls.consumerNote.setValue(this.clampValue(value, this.consumerNoteMaxLength));
  }

  protected onPhoneBlur(): void {
    const rawValue = this.form.controls.phone.value ?? '';
    const normalized = normalizePhoneE164(rawValue);
    if (normalized !== rawValue) {
      this.form.controls.phone.setValue(normalized);
    }

    this.checkDuplicate();
  }

  private clampValue(value: string, maxLength: number): string {
    if (value.length <= maxLength) return value;
    return value.slice(0, maxLength);
  }

  protected checkDuplicate(): void {
    const phoneValue = normalizePhoneE164(this.form.controls.phone.value ?? '').trim();
    if (phoneValue && phoneValue !== this.form.controls.phone.value) {
      this.form.controls.phone.setValue(phoneValue);
    }

    this.leadsService.checkDuplicate(phoneValue).subscribe({
      next: (result) => {
        if (result.isDuplicate && result.existingLead) {
          this.duplicateWarning.set(result.existingLead);
        } else {
          this.duplicateWarning.set(null);
        }
      },
    });
  }

  protected dismissDuplicateWarning(): void {
    this.duplicateWarning.set(null);
  }

  protected save(): void {
    this.submitAttempted.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;

    this.saving.set(true);
    this.error.set(null);

    const values = this.form.getRawValue();

    if (this.isNew()) {
      const sourceValue = (values.source ?? '').trim();
      const consumerNoteValue = (values.consumerNote ?? '').trim();
      const emailValue = (values.email ?? '').trim();
      const request: CreateLeadRequest = {
        firstName: (values.firstName ?? '').trim(),
        lastName: (values.lastName ?? '').trim(),
        phone: normalizePhoneE164(values.phone ?? ''),
        consumerRole: values.consumerRole,
        street: (values.street ?? '').trim(),
        houseNumber: (values.houseNumber ?? '').trim(),
        zipCode: (values.zipCode ?? '').trim(),
        city: (values.city ?? '').trim(),
        serviceType: (values.serviceType ?? '').trim(),
        whatsappOptedIn: values.whatsappOptedIn ?? true,
        ...this.trackingData(),
        ...(emailValue && { email: emailValue }),
        ...(values.latitude !== null && { latitude: values.latitude }),
        ...(values.longitude !== null && { longitude: values.longitude }),
        ...(sourceValue && { source: sourceValue }),
        ...(consumerNoteValue && { consumerNote: consumerNoteValue }),
      };

      this.leadsService.create(request).subscribe({
        next: (created) => {
          this.router.navigate(['/app/leads', created.id]);
        },
        error: (err) => {
          const message = extractErrorMessage(err, this.translate.instant('leads.form.errors.createLead'));
          this.error.set(message);
          this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
          this.saving.set(false);
        },
      });
    } else {
      const lead = this.lead();
      if (!lead) return;

      // Note: serviceType is no longer updated here - services are managed per-service in detail view
      const emailValue = (values.email ?? '').trim();
      const request: UpdateLeadRequest = {
        firstName: (values.firstName ?? '').trim(),
        lastName: (values.lastName ?? '').trim(),
        phone: normalizePhoneE164(values.phone ?? ''),
        consumerRole: values.consumerRole,
        street: (values.street ?? '').trim(),
        houseNumber: (values.houseNumber ?? '').trim(),
        zipCode: (values.zipCode ?? '').trim(),
        city: (values.city ?? '').trim(),
        whatsappOptedIn: values.whatsappOptedIn ?? true,
        ...(emailValue && { email: emailValue }),
        ...(values.latitude !== null && { latitude: values.latitude }),
        ...(values.longitude !== null && { longitude: values.longitude }),
      };

      this.leadsService.update(lead.id, request).subscribe({
        next: (updated) => {
          this.router.navigate(['/app/leads', updated.id]);
        },
        error: (err) => {
          const message = extractErrorMessage(err, this.translate.instant('leads.form.errors.updateLead'));
          this.error.set(message);
          this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
          this.saving.set(false);
        },
      });
    }
  }


  protected cancel(): void {
    if (this.isNew()) {
      this.router.navigate(['/app/leads']);
    } else {
      const lead = this.lead();
      if (lead) {
        this.router.navigate(['/app/leads', lead.id]);
      } else {
        this.router.navigate(['/app/leads']);
      }
    }
  }

  protected goToSettings(): void {
    this.router.navigate(['/app/organization/settings']);
  }

  protected requiredControlError(control: AbstractControl | null): string {
    if (!this.submitAttempted()) return '';
    if (!control?.hasError('required')) return '';
    return this.requiredError();
  }

  protected phoneControlError(): string {
    if (!this.submitAttempted()) return '';
    const control = this.form.controls.phone;
    if (control.hasError('required')) return this.requiredError();
    if (control.hasError('invalidPhone')) return this.invalidPhoneError();
    return '';
  }
}
