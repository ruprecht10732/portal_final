import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, finalize } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { OrganizationService, UpdateOrganizationRequest } from '../../../core/services/organization.service';

@Component({
  selector: 'app-organization-overview',
  imports: [ButtonComponent, InputComponent, TranslatePipe],
  templateUrl: './organization-overview.component.html',
  styleUrl: './organization-overview.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationOverviewComponent {
  protected readonly name = signal('');
  protected readonly initialName = signal('');
  protected readonly email = signal('');
  protected readonly initialEmail = signal('');
  protected readonly phone = signal('');
  protected readonly initialPhone = signal('');
  protected readonly vatNumber = signal('');
  protected readonly initialVatNumber = signal('');
  protected readonly kvkNumber = signal('');
  protected readonly initialKvkNumber = signal('');
  protected readonly addressLine1 = signal('');
  protected readonly initialAddressLine1 = signal('');
  protected readonly addressLine2 = signal('');
  protected readonly initialAddressLine2 = signal('');
  protected readonly postalCode = signal('');
  protected readonly initialPostalCode = signal('');
  protected readonly city = signal('');
  protected readonly initialCity = signal('');
  protected readonly country = signal('');
  protected readonly initialCountry = signal('');

  protected readonly isLoading = signal(true);
  protected readonly isSaving = signal(false);
  protected readonly successMessage = signal('');
  protected readonly errorMessage = signal('');

  private readonly orgService = inject(OrganizationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);
  private readonly lang = toSignal(this.translate.onLangChange, {
    initialValue: { lang: 'en', translations: {} },
  });

  protected readonly nameError = computed(() => {
    this.lang();
    return this.name().trim()
      ? ''
      : this.translate.instant('organization.errors.nameRequired');
  });

  protected readonly emailError = computed(() => {
    this.lang();
    const value = this.email().trim();
    if (!value) return '';
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    return isValid ? '' : this.translate.instant('organization.errors.emailInvalid');
  });

  protected readonly hasChanges = computed(() =>
    this.name().trim() !== this.initialName().trim() ||
    this.email().trim() !== this.initialEmail().trim() ||
    this.phone().trim() !== this.initialPhone().trim() ||
    this.vatNumber().trim().toUpperCase() !== this.initialVatNumber().trim().toUpperCase() ||
    this.kvkNumber().trim() !== this.initialKvkNumber().trim() ||
    this.addressLine1().trim() !== this.initialAddressLine1().trim() ||
    this.addressLine2().trim() !== this.initialAddressLine2().trim() ||
    this.postalCode().trim() !== this.initialPostalCode().trim() ||
    this.city().trim() !== this.initialCity().trim() ||
    this.country().trim() !== this.initialCountry().trim()
  );

  protected readonly canSave = computed(() =>
    !this.isSaving() &&
    !this.nameError() &&
    !this.emailError() &&
    this.hasChanges()
  );

  constructor() {
    this.loadOrganization();
  }

  private loadOrganization(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.orgService
      .getOrganization()
      .pipe(
        catchError(error => {
          this.errorMessage.set(this.normalizeError(error));
          return EMPTY;
        }),
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(org => {
        this.name.set(org.name ?? '');
        this.initialName.set(org.name ?? '');
        this.email.set(org.email ?? '');
        this.initialEmail.set(org.email ?? '');
        this.phone.set(org.phone ?? '');
        this.initialPhone.set(org.phone ?? '');
        this.vatNumber.set(org.vatNumber ?? '');
        this.initialVatNumber.set(org.vatNumber ?? '');
        this.kvkNumber.set(org.kvkNumber ?? '');
        this.initialKvkNumber.set(org.kvkNumber ?? '');
        this.addressLine1.set(org.addressLine1 ?? '');
        this.initialAddressLine1.set(org.addressLine1 ?? '');
        this.addressLine2.set(org.addressLine2 ?? '');
        this.initialAddressLine2.set(org.addressLine2 ?? '');
        this.postalCode.set(org.postalCode ?? '');
        this.initialPostalCode.set(org.postalCode ?? '');
        this.city.set(org.city ?? '');
        this.initialCity.set(org.city ?? '');
        this.country.set(org.country ?? '');
        this.initialCountry.set(org.country ?? '');
      });
  }

  protected save(): void {
    if (!this.canSave()) return;

    this.isSaving.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    const payload = this.buildPayload();

    this.orgService
      .updateOrganization(payload)
      .pipe(
        catchError(error => {
          this.errorMessage.set(this.normalizeError(error));
          return EMPTY;
        }),
        finalize(() => this.isSaving.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(org => {
        this.name.set(org.name ?? '');
        this.initialName.set(org.name ?? '');
        this.email.set(org.email ?? '');
        this.initialEmail.set(org.email ?? '');
        this.phone.set(org.phone ?? '');
        this.initialPhone.set(org.phone ?? '');
        this.vatNumber.set(org.vatNumber ?? '');
        this.initialVatNumber.set(org.vatNumber ?? '');
        this.kvkNumber.set(org.kvkNumber ?? '');
        this.initialKvkNumber.set(org.kvkNumber ?? '');
        this.addressLine1.set(org.addressLine1 ?? '');
        this.initialAddressLine1.set(org.addressLine1 ?? '');
        this.addressLine2.set(org.addressLine2 ?? '');
        this.initialAddressLine2.set(org.addressLine2 ?? '');
        this.postalCode.set(org.postalCode ?? '');
        this.initialPostalCode.set(org.postalCode ?? '');
        this.city.set(org.city ?? '');
        this.initialCity.set(org.city ?? '');
        this.country.set(org.country ?? '');
        this.initialCountry.set(org.country ?? '');
        this.successMessage.set(this.translate.instant('organization.saved'));
      });
  }

  private buildPayload(): UpdateOrganizationRequest {
    const payload: UpdateOrganizationRequest = {
      name: this.name().trim(),
    };

    const email = this.email().trim();
    if (email) payload.email = email;
    const phone = this.phone().trim();
    if (phone) payload.phone = phone;
    const vat = this.vatNumber().trim();
    if (vat) payload.vatNumber = vat.toUpperCase();
    const kvk = this.kvkNumber().trim();
    if (kvk) payload.kvkNumber = kvk;
    const line1 = this.addressLine1().trim();
    if (line1) payload.addressLine1 = line1;
    const line2 = this.addressLine2().trim();
    if (line2) payload.addressLine2 = line2;
    const postal = this.postalCode().trim();
    if (postal) payload.postalCode = postal;
    const city = this.city().trim();
    if (city) payload.city = city;
    const country = this.country().trim();
    if (country) payload.country = country;

    return payload;
  }

  private normalizeError(error: unknown): string {
    if (typeof error === 'string') return error;
    if (error && typeof error === 'object' && 'error' in error) {
      const value = (error as { error?: string }).error;
      if (value) return value;
    }
    if (error && typeof error === 'object' && 'message' in error) {
      const value = (error as { message?: string }).message;
      if (value) return value;
    }
    return this.translate.instant('organization.errors.generic');
  }
}
