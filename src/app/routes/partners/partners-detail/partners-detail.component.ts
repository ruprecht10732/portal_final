import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { PartnersService } from '../../../core/services/partners.service';
import { ServiceTypesService } from '../../../core/services/service-types.service';
import type { Partner, UpdatePartnerRequest } from '../../../core/services/partners.types';
import type { ServiceTypeItem } from '../../../core/services/service-types.types';
import { ErrorReportingService } from '../../../core/services/error-reporting.service';
import { ToastService } from '../../../core/services/toast.service';
import { extractErrorMessage } from '../../../core/utils/error-utils';
import { formatFullAddress } from '../../../core/utils/address.util';
import type { AddressParts } from '../../../core/utils/address.util';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { type MultiSelectOption } from '../../../shared/components/multiselect/multiselect.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { PartnerDetailAddressCardComponent } from './partner-detail-address-card/partner-detail-address-card.component';
import { PartnerDetailCompanyCardComponent } from './partner-detail-company-card/partner-detail-company-card.component';
import { PartnerDetailContactCardComponent } from './partner-detail-contact-card/partner-detail-contact-card.component';
import { PartnerDetailHeroCardComponent } from './partner-detail-hero-card/partner-detail-hero-card.component';
import { PartnerDetailServicesCardComponent } from './partner-detail-services-card/partner-detail-services-card.component';
import { PartnerDetailOffersCardComponent } from './partner-detail-offers-card/partner-detail-offers-card.component';
import { AddressSuggestion } from '../../../core/services/address.service';

@Component({
  selector: 'app-partners-detail',
  templateUrl: './partners-detail.component.html',
  styleUrl: './partners-detail.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslatePipe,
    LucideAngularModule,
    ButtonComponent,
    ConfirmDialogComponent,
    PageHeaderComponent,
    PartnerDetailHeroCardComponent,
    PartnerDetailCompanyCardComponent,
    PartnerDetailContactCardComponent,
    PartnerDetailAddressCardComponent,
    PartnerDetailServicesCardComponent,
    PartnerDetailOffersCardComponent,
  ],
})
export class PartnersDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly partnersService = inject(PartnersService);
  private readonly serviceTypesService = inject(ServiceTypesService);
  private readonly reporter = inject(ErrorReportingService);
  private readonly translate = inject(TranslateService);
  private readonly toast = inject(ToastService);

  protected readonly partner = signal<Partner | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly deleting = signal(false);
  protected readonly showDeleteDialog = signal(false);
  protected readonly logoDownloadUrl = signal<string | null>(null);
  protected readonly logoError = signal<string | null>(null);
  protected readonly logoImageError = signal(false);
  protected readonly serviceTypes = signal<ServiceTypeItem[]>([]);
  protected readonly serviceTypesLoading = signal(false);
  protected readonly serviceTypesError = signal<string | null>(null);
  protected readonly serviceTypesEditing = signal(false);
  protected readonly serviceTypesSaving = signal(false);
  protected readonly serviceTypeSelection = signal<string[]>([]);
  protected readonly partnerOffers = signal<import('../../../core/services/partners.types').OfferResponse[]>([]);
  protected readonly offersLoading = signal(false);
  protected readonly offersError = signal<string | null>(null);
  protected readonly editingField = signal<EditablePartnerField | null>(null);
  protected readonly savingField = signal<EditablePartnerField | null>(null);
  protected readonly editValue = signal('');
  protected readonly serviceTypeLabels = computed<Record<string, string>>(() => (
    this.serviceTypes().reduce((acc, item) => {
      acc[item.id] = item.name;
      return acc;
    }, {} as Record<string, string>)
  ));
  protected readonly serviceTypeOptions = computed<MultiSelectOption<string>[]>(() => (
    this.serviceTypes().map(item => ({ label: item.name, value: item.id }))
  ));
  protected readonly logoPreviewUrl = computed(() => {
    return this.logoDownloadUrl();
  });
  protected readonly logoInitials = computed(() => {
    const name = this.partner()?.businessName || '';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'P';
    const first = parts[0] ?? '';
    if (parts.length === 1) return (first.slice(0, 2) || 'P').toUpperCase();
    const initials = `${first[0] ?? ''}${parts[1]?.[0] ?? ''}`.trim();
    return (initials || first.slice(0, 2) || 'P').toUpperCase();
  });

  protected readonly mapAddress = computed(() => {
    const partner = this.partner();
    if (!partner) return '';
    const address: AddressParts = {
      addressLine1: partner.addressLine1,
      postalCode: partner.postalCode,
      city: partner.city,
      country: partner.country,
    };

    if (partner.houseNumber != null) {
      address.houseNumber = partner.houseNumber;
    }
    if (partner.addressLine2 != null) {
      address.addressLine2 = partner.addressLine2;
    }

    return formatFullAddress(address);
  });

  protected readonly mapLatitude = computed(() => this.partner()?.latitude ?? null);
  protected readonly mapLongitude = computed(() => this.partner()?.longitude ?? null);

  protected readonly googleMapsUrl = computed(() => {
    const address = this.mapAddress().trim();
    if (!address) return '';
    const query = encodeURIComponent(address);
    return `https://www.google.com/maps/search/?api=1&query=${query}`;
  });

  protected readonly contactEmailUrl = computed(() => {
    const email = this.partner()?.contactEmail?.trim();
    return email ? `mailto:${email}` : '';
  });

  protected readonly contactPhoneUrl = computed(() => {
    const phone = this.partner()?.contactPhone?.trim();
    return phone ? `tel:${phone}` : '';
  });

  protected readonly whatsappUrl = computed(() => {
    const phone = this.partner()?.contactPhone?.trim();
    if (!phone) return '';
    const sanitized = phone.replaceAll(/[^0-9+]/g, '');
    const number = sanitized.startsWith('+') ? sanitized.slice(1) : sanitized;
    if (!number) return '';
    return `https://wa.me/${number}`;
  });

  protected readonly companyRows = computed<DetailRow[]>(() => {
    const partner = this.partner();
    return [
      {
        key: 'businessName',
        labelKey: 'partners.form.businessName',
        value: partner?.businessName ?? '',
      },
      {
        key: 'kvkNumber',
        labelKey: 'partners.form.kvkNumber',
        value: partner?.kvkNumber ?? '',
      },
      {
        key: 'vatNumber',
        labelKey: 'partners.form.vatNumber',
        value: partner?.vatNumber ?? '',
      },
    ];
  });

  protected readonly contactRows = computed<DetailRow[]>(() => {
    const partner = this.partner();
    return [
      {
        key: 'contactName',
        labelKey: 'partners.form.contactName',
        value: partner?.contactName ?? '',
      },
      {
        key: 'contactEmail',
        labelKey: 'partners.form.contactEmail',
        value: partner?.contactEmail ?? '',
      },
      {
        key: 'contactPhone',
        labelKey: 'partners.form.contactPhone',
        value: partner?.contactPhone ?? '',
        formatAsPhone: true,
      },
    ];
  });

  protected readonly addressRows = computed<DetailRow[]>(() => {
    const partner = this.partner();
    return [
      {
        key: 'addressLine1',
        labelKey: 'partners.form.addressLine1',
        value: partner?.addressLine1 ?? '',
      },
      {
        key: 'houseNumber',
        labelKey: 'partners.form.houseNumber',
        value: partner?.houseNumber ?? '',
      },
      {
        key: 'addressLine2',
        labelKey: 'partners.form.addressLine2',
        value: partner?.addressLine2 ?? '',
      },
      {
        key: 'postalCode',
        labelKey: 'partners.form.postalCode',
        value: partner?.postalCode ?? '',
      },
      {
        key: 'city',
        labelKey: 'partners.form.city',
        value: partner?.city ?? '',
      },
      {
        key: 'country',
        labelKey: 'partners.form.country',
        value: partner?.country ?? '',
      },
    ];
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.goBack();
      return;
    }
    this.loadPartner(id);
  }

  protected goBack(): void {
    this.router.navigate(['/app/partners']);
  }

  protected editPartner(): void {
    const partner = this.partner();
    if (!partner) return;
    this.router.navigate(['/app/partners', partner.id, 'edit']);
  }

  protected startEdit(key: EditablePartnerField): void {
    if (this.savingField()) return;
    this.editValue.set(this.getFieldValue(key));
    this.editingField.set(key);
  }

  protected startEditFromEvent(key: string): void {
    if (!this.isEditableField(key)) return;
    this.startEdit(key);
  }

  protected cancelEdit(): void {
    this.editingField.set(null);
    this.editValue.set('');
  }

  protected saveEdit(key: EditablePartnerField): void {
    if (this.savingField()) return;
    const partner = this.partner();
    if (!partner) return;

    const rawValue = this.editValue().trim();
    const request = this.buildUpdateRequest(key, rawValue);
    if (!request) return;

    this.savingField.set(key);
    this.partnersService.update(partner.id, request).subscribe({
      next: updated => {
        this.partner.set(updated);
        this.savingField.set(null);
        this.cancelEdit();
      },
      error: err => {
        const message = extractErrorMessage(err, this.translate.instant('partners.form.errors.updateFailed'));
        this.toast.error(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.savingField.set(null);
      },
    });
  }

  protected saveEditFromEvent(key: string): void {
    if (!this.isEditableField(key)) return;
    this.saveEdit(key);
  }

  protected applyAddressSuggestion(payload: { key: string; suggestion: AddressSuggestion }): void {
    if (payload.key !== 'addressLine1' || this.savingField()) return;
    const partner = this.partner();
    if (!partner) return;

    const suggestion = payload.suggestion;
    const latitude = this.parseCoordinate(suggestion.lat);
    const longitude = this.parseCoordinate(suggestion.lon);
    const request: UpdatePartnerRequest = {
      addressLine1: suggestion.street ?? suggestion.label ?? partner.addressLine1,
      houseNumber: suggestion.houseNumber ?? partner.houseNumber ?? undefined,
      postalCode: suggestion.zipCode ?? partner.postalCode,
      city: suggestion.city ?? partner.city,
      country: suggestion.country ?? partner.country,
      ...(latitude !== null && { latitude }),
      ...(longitude !== null && { longitude }),
    };

    this.savingField.set('addressLine1');
    this.partnersService.update(partner.id, request).subscribe({
      next: updated => {
        this.partner.set(updated);
        this.savingField.set(null);
        this.cancelEdit();
      },
      error: err => {
        const message = extractErrorMessage(err, this.translate.instant('partners.form.errors.updateFailed'));
        this.toast.error(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.savingField.set(null);
      },
    });
  }

  protected openServiceTypesEdit(): void {
    const partner = this.partner();
    if (!partner) return;
    this.serviceTypeSelection.set([...(partner.serviceTypeIds ?? [])]);
    this.serviceTypesEditing.set(true);
  }

  protected closeServiceTypesEdit(): void {
    this.serviceTypesEditing.set(false);
  }

  protected saveServiceTypes(): void {
    const partner = this.partner();
    if (!partner || this.serviceTypesSaving()) return;

    const serviceTypeIds = this.serviceTypeSelection();
    this.serviceTypesSaving.set(true);

    this.partnersService.update(partner.id, { serviceTypeIds }).subscribe({
      next: updated => {
        this.partner.set(updated);
        this.serviceTypesSaving.set(false);
        this.serviceTypesEditing.set(false);
      },
      error: err => {
        const message = extractErrorMessage(err, this.translate.instant('partners.form.errors.updateFailed'));
        this.toast.error(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.serviceTypesSaving.set(false);
      },
    });
  }

  protected removeServiceType(serviceTypeId: string): void {
    const partner = this.partner();
    if (!partner || this.serviceTypesSaving()) return;

    const current = partner.serviceTypeIds ?? [];
    const next = current.filter(id => id !== serviceTypeId);
    this.serviceTypesSaving.set(true);

    this.partnersService.update(partner.id, { serviceTypeIds: next }).subscribe({
      next: updated => {
        this.partner.set(updated);
        this.serviceTypesSaving.set(false);
      },
      error: err => {
        const message = extractErrorMessage(err, this.translate.instant('partners.form.errors.updateFailed'));
        this.toast.error(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.serviceTypesSaving.set(false);
      },
    });
  }

  protected openDeleteDialog(): void {
    this.showDeleteDialog.set(true);
  }

  protected closeDeleteDialog(): void {
    this.showDeleteDialog.set(false);
  }

  protected confirmDelete(): void {
    const partner = this.partner();
    if (!partner || this.deleting()) return;

    this.deleting.set(true);
    this.partnersService.delete(partner.id).subscribe({
      next: () => {
        this.toast.success(this.translate.instant('partners.detail.deleteSuccess'));
        this.router.navigate(['/app/partners']);
      },
      error: err => {
        const message = extractErrorMessage(err, this.translate.instant('partners.errors.deleteFailed'));
        this.toast.error(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.deleting.set(false);
        this.closeDeleteDialog();
      },
    });
  }

  protected openGoogleMaps(): void {
    const url = this.googleMapsUrl();
    if (!url) return;
    window.open(url, '_blank', 'noopener');
  }

  protected openWhatsApp(): void {
    const url = this.whatsappUrl();
    if (!url) return;
    window.open(url, '_blank', 'noopener');
  }

  protected openCall(): void {
    const url = this.contactPhoneUrl();
    if (!url) return;
    window.open(url, '_self');
  }

  protected openEmail(): void {
    const url = this.contactEmailUrl();
    if (!url) return;
    window.open(url, '_self');
  }

  protected formatDate(value: string): string {
    return new Intl.DateTimeFormat('nl-NL', {
      dateStyle: 'long',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  private parseCoordinate(value?: string): number | null {
    if (!value) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private loadPartner(id: string): void {
    this.loading.set(true);
    this.partnersService.getById(id).subscribe({
      next: partner => {
        this.partner.set(partner);
        this.loading.set(false);
        this.loadServiceTypes();
        this.loadLogo(partner);
        this.loadOffers(partner.id);
      },
      error: err => {
        const message = extractErrorMessage(err, this.translate.instant('partners.errors.loadFailed'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.loading.set(false);
      },
    });
  }

  private loadServiceTypes(): void {
    this.serviceTypesLoading.set(true);
    this.serviceTypesError.set(null);
    this.serviceTypesService.listAdmin({ page: 1, pageSize: 100, sortBy: 'name', sortOrder: 'asc' }).subscribe({
      next: response => {
        this.serviceTypes.set(response.items ?? []);
        this.serviceTypesLoading.set(false);
      },
      error: () => {
        this.serviceTypesService.listActive().subscribe({
          next: response => {
            this.serviceTypes.set(response.items ?? []);
            this.serviceTypesLoading.set(false);
          },
          error: err => {
            const message = extractErrorMessage(err, this.translate.instant('partners.detail.errors.loadServiceTypes'));
            this.serviceTypesError.set(message);
            this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
            this.serviceTypesLoading.set(false);
          },
        });
      },
    });
  }

  private loadLogo(partner: Partner): void {
    if (!partner.logoFileKey) {
      this.logoDownloadUrl.set(null);
      this.logoImageError.set(false);
      return;
    }

    this.partnersService.getLogoDownloadUrl(partner.id).subscribe({
      next: response => {
        this.logoDownloadUrl.set(response.downloadUrl);
        this.logoImageError.set(false);
        this.logoError.set(null);
      },
      error: err => {
        const message = extractErrorMessage(err, this.translate.instant('partners.detail.errors.loadLogo'));
        this.logoError.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
      },
    });
  }

  private loadOffers(partnerId: string): void {
    this.offersLoading.set(true);
    this.offersError.set(null);
    this.partnersService.listPartnerOffers(partnerId).subscribe({
      next: response => {
        this.partnerOffers.set(response.items ?? []);
        this.offersLoading.set(false);
      },
      error: err => {
        const message = extractErrorMessage(err, 'Kon werkaanbiedingen niet laden');
        this.offersError.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.offersLoading.set(false);
      },
    });
  }

  protected refreshOffers(): void {
    const partner = this.partner();
    if (partner) {
      this.loadOffers(partner.id);
    }
  }

  private getFieldValue(key: EditablePartnerField): string {
    const partner = this.partner();
    if (!partner) return '';

    switch (key) {
      case 'businessName':
        return partner.businessName ?? '';
      case 'kvkNumber':
        return partner.kvkNumber ?? '';
      case 'vatNumber':
        return partner.vatNumber ?? '';
      case 'contactName':
        return partner.contactName ?? '';
      case 'contactEmail':
        return partner.contactEmail ?? '';
      case 'contactPhone':
        return partner.contactPhone ?? '';
      case 'addressLine1':
        return partner.addressLine1 ?? '';
      case 'houseNumber':
        return partner.houseNumber ?? '';
      case 'addressLine2':
        return partner.addressLine2 ?? '';
      case 'postalCode':
        return partner.postalCode ?? '';
      case 'city':
        return partner.city ?? '';
      case 'country':
        return partner.country ?? '';
      default:
        return '';
    }
  }

  private buildUpdateRequest(key: EditablePartnerField, value: string): UpdatePartnerRequest | null {
    if (key === 'addressLine2') {
      return { addressLine2: value || null };
    }

    if (!value) return null;

    const request: UpdatePartnerRequest = { [key]: value } as UpdatePartnerRequest;
    return request;
  }

  private isEditableField(key: string): key is EditablePartnerField {
    return EDITABLE_FIELDS.has(key as EditablePartnerField);
  }
}

type EditablePartnerField =
  | 'businessName'
  | 'kvkNumber'
  | 'vatNumber'
  | 'contactName'
  | 'contactEmail'
  | 'contactPhone'
  | 'addressLine1'
  | 'houseNumber'
  | 'addressLine2'
  | 'postalCode'
  | 'city'
  | 'country';

const EDITABLE_FIELDS = new Set<EditablePartnerField>([
  'businessName',
  'kvkNumber',
  'vatNumber',
  'contactName',
  'contactEmail',
  'contactPhone',
  'addressLine1',
  'houseNumber',
  'addressLine2',
  'postalCode',
  'city',
  'country',
]);

interface DetailRow {
  key: EditablePartnerField;
  labelKey: string;
  value: string;
}
