import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, distinctUntilChanged, EMPTY, filter, finalize, firstValueFrom, map, of, switchMap } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { AutocompleteComponent, type AutocompleteOption } from '../../../shared/components/autocomplete/autocomplete.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { FileUploaderComponent, type PresignedUpload } from '../../../shared/components/file-uploader/file-uploader.component';
import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';
import { CardComponent } from '../../../shared/components/card/card.component';
import { SkeletonComponent } from '../../../shared/components/skeleton/skeleton.component';
import { AddressService, type AddressSuggestion } from '../../../core/services/address.service';
import { OrganizationService, type Organization, UpdateOrganizationRequest } from '../../../core/services/organization.service';
import { DEBOUNCE_MS, MIN_LENGTH } from '../../../core/config';
import { isEmailValid } from '../../../core/utils/email.util';
import { isKvkValid, isVatValid } from '../../../core/utils/partner-validation.util';

@Component({
  selector: 'app-organization-overview',
  imports: [ButtonComponent, AutocompleteComponent, InputComponent, FileUploaderComponent, PageLayoutComponent, CardComponent, SkeletonComponent, TranslatePipe],
  templateUrl: './organization-overview.component.html',
  styleUrl: './organization-overview.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'xl:flex xl:flex-col xl:flex-1 xl:min-h-0 xl:overflow-y-auto' },
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
  protected readonly addressOptions = signal<AutocompleteOption[]>([]);
  private readonly addressSuggestions = signal<AddressSuggestion[]>([]);
  private readonly hasAddressInput = signal(false);

  protected readonly isLoading = signal(true);
  protected readonly isSaving = signal(false);
  protected readonly successMessage = signal('');
  protected readonly errorMessage = signal('');

  // Logo state
  protected readonly logoUrl = signal<string | null>(null);
  protected readonly logoLoading = signal(false);
  protected readonly logoError = signal<string | null>(null);
  protected readonly logoDeletingInProgress = signal(false);



  private readonly orgService = inject(OrganizationService);
  private readonly addressService = inject(AddressService);
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
    const isValid = isEmailValid(value);
    return isValid ? '' : this.translate.instant('organization.errors.emailInvalid');
  });

  protected readonly vatError = computed(() => {
    this.lang();
    const value = this.vatNumber().trim();
    if (!value) return '';
    return isVatValid(value)
      ? ''
      : this.translate.instant('organization.errors.vatInvalid');
  });

  protected readonly kvkError = computed(() => {
    this.lang();
    const value = this.kvkNumber().trim();
    if (!value) return '';
    return isKvkValid(value)
      ? ''
      : this.translate.instant('organization.errors.kvkInvalid');
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
    !this.vatError() &&
    !this.kvkError() &&
    this.hasChanges()
  );


  constructor() {
    this.setupAddressSearch();
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
      .subscribe(org => this.applyOrganization(org));
  }

  private applyOrganization(
    org: Organization,
    options?: { resetAddress?: boolean }
  ): void {
    const resetAddress = options?.resetAddress ?? true;
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
    if (resetAddress) {
      this.hasAddressInput.set(false);
      this.addressOptions.set([]);
      this.addressSuggestions.set([]);
    }

    this.loadLogoDownloadUrl(org);
  }

  private setupAddressSearch(): void {
    effect(() => {
      if (this.addressLine1().trim().length < MIN_LENGTH.address) {
        this.addressOptions.set([]);
        this.addressSuggestions.set([]);
      }
    });

    toObservable(this.addressLine1)
      .pipe(
        map(value => value.trim()),
        filter(() => this.hasAddressInput()),
        filter(value => value.length >= MIN_LENGTH.address),
        debounceTime(DEBOUNCE_MS.search),
        distinctUntilChanged(),
        switchMap(query => this.addressService.search(query).pipe(
          catchError(() => of([]))
        )),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(results => {
        this.addressSuggestions.set(results);
        this.addressOptions.set(results.map(addr => ({
          label: addr.label,
          value: addr.label,
        })));
      });
  }

  protected onAddressLine1Change(value: string): void {
    this.hasAddressInput.set(true);
    this.addressLine1.set(value);

    const match = this.addressSuggestions().find(suggestion => suggestion.label === value);
    if (match) {
      this.applyAddressSuggestion(match);
    }
  }

  private applyAddressSuggestion(suggestion: AddressSuggestion): void {
    this.addressLine1.set(this.formatAddressLine1(suggestion));
    if (suggestion.zipCode) this.postalCode.set(suggestion.zipCode);
    if (suggestion.city) this.city.set(suggestion.city);
    if (suggestion.country) this.country.set(suggestion.country);
    this.hasAddressInput.set(false);
    this.addressOptions.set([]);
    this.addressSuggestions.set([]);
  }

  private formatAddressLine1(suggestion: AddressSuggestion): string {
    return [suggestion.street, suggestion.houseNumber]
      .map(part => part?.trim())
      .filter(Boolean)
      .join(' ')
      .trim();
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
        this.applyOrganization(org, { resetAddress: false });
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

  // ---------------------------------------------------------------------------
  // Logo upload
  // ---------------------------------------------------------------------------

  protected presignLogo = async (file: File): Promise<PresignedUpload> => {
    const response = await firstValueFrom(this.orgService.presignLogo({
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
    }));

    if (!response) {
      throw new Error(this.translate.instant('organization.logo.uploadFailed'));
    }

    return { uploadUrl: response.uploadUrl, fileKey: response.fileKey };
  };

  protected finalizeLogo = async (file: File, presigned: PresignedUpload): Promise<unknown> => {
    const updated = await firstValueFrom(this.orgService.setLogo({
      fileKey: presigned.fileKey,
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
    }));

    if (!updated) {
      throw new Error(this.translate.instant('organization.logo.uploadFailed'));
    }

    this.applyOrganization(updated, { resetAddress: false });
    this.loadLogoDownloadUrl(updated);
    return updated;
  };

  protected deleteLogo(): void {
    this.logoDeletingInProgress.set(true);
    this.logoError.set(null);

    this.orgService
      .deleteLogo()
      .pipe(
        catchError(error => {
          this.logoError.set(this.normalizeError(error));
          return EMPTY;
        }),
        finalize(() => this.logoDeletingInProgress.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(org => {
        this.applyOrganization(org, { resetAddress: false });
        this.logoUrl.set(null);
      });
  }

  private loadLogoDownloadUrl(org: Organization): void {
    if (!org.logoFileKey) {
      this.logoUrl.set(null);
      return;
    }

    this.logoLoading.set(true);
    this.logoError.set(null);

    this.orgService
      .getLogoDownloadUrl()
      .pipe(
        catchError(() => {
          this.logoUrl.set(null);
          return EMPTY;
        }),
        finalize(() => this.logoLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(result => {
        this.logoUrl.set(result.downloadUrl);
      });
  }
}
