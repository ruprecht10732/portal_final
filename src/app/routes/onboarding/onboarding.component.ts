import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, distinctUntilChanged, EMPTY, filter, finalize, firstValueFrom, of, Subscription, switchMap, timer } from 'rxjs';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { InputComponent } from '../../shared/components/input/input.component';
import { TextareaComponent } from '../../shared/components/textarea/textarea.component';
import { IconPickerComponent } from '../../shared/components/icon-picker/icon-picker.component';
import { ColorPickerComponent } from '../../shared/components/color-picker/color-picker.component';
import { SelectComponent, type SelectOption } from '../../shared/components/select/select.component';
import { NumberInputComponent } from '../../shared/components/number-input/number-input.component';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../core/services/auth.service';
import { UserService } from '../../core/services/user.service';
import { ServiceTypesService } from '../../core/services/service-types.service';
import { OrganizationService, WhatsAppStatus } from '../../core/services/organization.service';
import { CatalogService, type ProductType, type VatRate } from '../../core/services/catalog.service';
import type { CompleteOnboardingRequest } from '../../core/services/user.types';
import type { CreateServiceTypeRequest } from '../../core/services/service-types.types';

@Component({
  selector: 'app-onboarding',
  imports: [
    ButtonComponent,
    InputComponent,
    TextareaComponent,
    IconPickerComponent,
    ColorPickerComponent,
    SelectComponent,
    NumberInputComponent,
    TranslatePipe,
  ],
  templateUrl: './onboarding.component.html',
  styleUrl: './onboarding.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnboardingComponent {
  protected readonly firstName = signal('');
  protected readonly lastName = signal('');
  protected readonly organizationName = signal('');
  protected readonly organizationEmail = signal('');
  protected readonly organizationPhone = signal('');
  protected readonly vatNumber = signal('');
  protected readonly kvkNumber = signal('');
  protected readonly addressLine1 = signal('');
  protected readonly addressLine2 = signal('');
  protected readonly postalCode = signal('');
  protected readonly city = signal('');
  protected readonly country = signal('Nederland');
  protected readonly needsOrganization = signal(false);
  protected readonly currentStep = signal(1);
  protected readonly stepAttempted = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly globalError = signal('');

  protected readonly serviceTypeName = signal('');
  protected readonly serviceTypeDescription = signal('');
  protected readonly intakeGuidelines = signal('');
  protected readonly serviceTypeIcon = signal<string | null>(null);
  protected readonly serviceTypeColor = signal('');
  protected readonly serviceTypeSkipped = signal(false);
  protected readonly showIntakeExamples = signal(false);
  protected readonly serviceTypeCreating = signal(false);
  protected readonly serviceTypeError = signal('');

  protected readonly productTitle = signal('');
  protected readonly productReference = signal('');
  protected readonly productPrice = signal<number | null>(null);
  protected readonly productVatRateId = signal<string | null>(null);
  protected readonly productType = signal<ProductType | null>(null);
  protected readonly vatRates = signal<VatRate[]>([]);
  protected readonly vatRatesLoading = signal(false);
  protected readonly productSkipped = signal(false);
  protected readonly productCreating = signal(false);
  protected readonly productError = signal('');

  // ── SMTP ──
  protected readonly smtpHost = signal('');
  protected readonly smtpPort = signal<number | null>(587);
  protected readonly smtpUsername = signal('');
  protected readonly smtpPassword = signal('');
  protected readonly smtpFromEmail = signal('');
  protected readonly smtpFromName = signal('');
  protected readonly smtpSkipped = signal(false);
  protected readonly isSmtpSaving = signal(false);
  protected readonly smtpErrorMessage = signal('');
  protected readonly smtpSuccessMessage = signal('');
  protected readonly smtpDetectedProvider = signal('');
  protected readonly isSmtpDetecting = signal(false);
  protected readonly smtpDetectionFailed = signal(false);
  protected readonly smtpDetectedHost = signal('');
  protected readonly smtpDetectedPort = signal<number | null>(null);
  protected readonly showSmtpAdvanced = signal(false);

  protected readonly whatsAppSkipped = signal(false);
  protected readonly whatsAppDeviceId = signal<string | null>(null);
  protected readonly whatsAppStatus = signal<WhatsAppStatus | null>(null);
  protected readonly isWhatsAppLoading = signal(false);
  protected readonly isWhatsAppAction = signal(false);
  protected readonly whatsAppErrorMessage = signal('');
  protected readonly whatsAppSuccessMessage = signal('');
  protected readonly qrBlobUrl = signal<string | null>(null);

  private statusPollingStarted = false;
  private qrRefreshSub: Subscription | null = null;
  private qrLoadInFlight = false;
  protected readonly onboardingPersisted = signal(false);

  protected readonly smtpStep = computed(() => (this.needsOrganization() ? 4 : -1));
  protected readonly whatsAppStep = computed(() => (this.needsOrganization() ? 5 : 2));
  protected readonly serviceTypeStep = computed(() => (this.needsOrganization() ? 6 : 3));
  protected readonly productStep = computed(() => (this.needsOrganization() ? 7 : 4));
  protected readonly totalSteps = computed(() => (this.needsOrganization() ? 7 : 4));

  protected readonly canSaveSMTP = computed(() =>
    !this.isSmtpSaving() &&
    this.smtpHost().trim().length > 0 &&
    (this.smtpPort() ?? 0) >= 1 &&
    this.smtpUsername().trim().length > 0 &&
    this.smtpPassword().trim().length > 0 &&
    this.smtpFromEmail().trim().length > 0 &&
    this.smtpFromName().trim().length > 0
  );

  protected readonly stepTitle = computed(() => {
    this.lang();
    if (this.currentStep() === 1) return this.t('onboarding.steps.profile.title');
    if (this.needsOrganization() && this.currentStep() === 2) return this.t('onboarding.steps.company.title');
    if (this.needsOrganization() && this.currentStep() === 3) return this.t('onboarding.steps.business.title');
    if (this.currentStep() === this.smtpStep()) return this.t('onboarding.steps.smtp.title');
    if (this.currentStep() === this.whatsAppStep()) return this.t('onboarding.steps.whatsapp.title');
    if (this.currentStep() === this.serviceTypeStep()) return this.t('onboarding.steps.service.title');
    if (this.currentStep() === this.productStep()) return this.t('onboarding.steps.product.title');
    return this.t('onboarding.title');
  });

  protected readonly stepSubtitle = computed(() => {
    this.lang();
    if (this.currentStep() === 1) return this.t('onboarding.steps.profile.subtitle');
    if (this.needsOrganization() && this.currentStep() === 2) return this.t('onboarding.steps.company.subtitle');
    if (this.needsOrganization() && this.currentStep() === 3) return this.t('onboarding.steps.business.subtitle');
    if (this.currentStep() === this.smtpStep()) return this.t('onboarding.steps.smtp.subtitle');
    if (this.currentStep() === this.whatsAppStep()) return this.t('onboarding.steps.whatsapp.subtitle');
    if (this.currentStep() === this.serviceTypeStep()) return this.t('onboarding.steps.service.subtitle');
    if (this.currentStep() === this.productStep()) return this.t('onboarding.steps.product.subtitle');
    return '';
  });

  protected readonly primaryLabel = computed(() => {
    this.lang();
    return this.currentStep() === this.totalSteps()
      ? this.t('onboarding.actions.finish')
      : this.t('onboarding.actions.continue');
  });

  protected readonly progressWidth = computed(() => {
    const total = this.totalSteps();
    const step = this.currentStep();
    const percentage = Math.min(100, Math.max(0, Math.round((step / total) * 100)));
    return `${percentage}%`;
  });

  protected readonly canProceed = computed(() => {
    if (this.currentStep() === 1) {
      return this.hasName();
    }
    if (!this.needsOrganization()) {
      if (this.currentStep() === this.whatsAppStep()) {
        return true;
      }
      if (this.currentStep() === this.serviceTypeStep()) {
        return this.canProceedServiceType();
      }
      if (this.currentStep() === this.productStep()) {
        return this.canProceedProduct();
      }
      return this.hasName();
    }
    if (this.currentStep() === 2) {
      return this.hasOrganizationBasics();
    }
    if (this.currentStep() === 3) {
      return this.hasValidBusinessDetails();
    }
    if (this.currentStep() === this.smtpStep()) {
      return true;
    }
    if (this.currentStep() === this.whatsAppStep()) {
      return true;
    }
    if (this.currentStep() === this.serviceTypeStep()) {
      return this.canProceedServiceType();
    }
    return this.canProceedProduct();
  });

  protected readonly firstNameError = computed(() =>
    this.shouldShowErrors(1) && !this.isNonEmpty(this.firstName())
      ? this.t('onboarding.errors.firstNameRequired')
      : ''
  );
  protected readonly lastNameError = computed(() =>
    this.shouldShowErrors(1) && !this.isNonEmpty(this.lastName())
      ? this.t('onboarding.errors.lastNameRequired')
      : ''
  );
  protected readonly organizationNameError = computed(() => {
    if (!this.shouldShowErrors(2)) return '';
    if (!this.needsOrganization()) return '';
    return this.isNonEmpty(this.organizationName()) ? '' : this.t('onboarding.errors.organizationNameRequired');
  });
  protected readonly organizationEmailError = computed(() => {
    if (!this.shouldShowErrors(2)) return '';
    if (!this.isNonEmpty(this.organizationEmail())) return this.t('onboarding.errors.organizationEmailRequired');
    return this.isEmailValid(this.organizationEmail()) ? '' : this.t('onboarding.errors.organizationEmailInvalid');
  });
  protected readonly organizationPhoneError = computed(() => {
    if (!this.shouldShowErrors(2)) return '';
    if (!this.isNonEmpty(this.organizationPhone())) return this.t('onboarding.errors.organizationPhoneRequired');
    return this.isPhoneValid(this.organizationPhone()) ? '' : this.t('onboarding.errors.organizationPhoneInvalid');
  });
  protected readonly vatNumberError = computed(() => {
    if (!this.shouldShowErrors(3)) return '';
    if (!this.isNonEmpty(this.vatNumber())) return '';
    return this.isVatValid(this.vatNumber()) ? '' : this.t('onboarding.errors.vatInvalid');
  });
  protected readonly kvkNumberError = computed(() => {
    if (!this.shouldShowErrors(3)) return '';
    if (!this.isNonEmpty(this.kvkNumber())) return '';
    return this.isKvkValid(this.kvkNumber()) ? '' : this.t('onboarding.errors.kvkInvalid');
  });
  protected readonly postalCodeError = computed(() => {
    if (!this.shouldShowErrors(3)) return '';
    if (!this.isNonEmpty(this.postalCode())) return '';
    return this.isPostalCodeValid(this.postalCode()) ? '' : this.t('onboarding.errors.postalInvalid');
  });

  protected readonly serviceTypeNameError = computed(() => {
    if (!this.shouldShowErrors(this.serviceTypeStep())) return '';
    if (this.serviceTypeSkipped()) return '';
    return this.isNonEmpty(this.serviceTypeName()) ? '' : this.t('onboarding.errors.serviceTypeNameRequired');
  });

  protected readonly intakeGuidelinesError = computed(() => {
    if (!this.shouldShowErrors(this.serviceTypeStep())) return '';
    if (this.serviceTypeSkipped()) return '';
    return this.isNonEmpty(this.intakeGuidelines())
        ? ''
        : this.t('onboarding.errors.intakeRequired');
  });

  protected readonly productTitleError = computed(() => {
    if (!this.shouldShowErrors(this.productStep())) return '';
    if (this.productSkipped()) return '';
    return this.isNonEmpty(this.productTitle()) ? '' : this.t('onboarding.errors.productTitleRequired');
  });

  protected readonly productReferenceError = computed(() => {
    if (!this.shouldShowErrors(this.productStep())) return '';
    if (this.productSkipped()) return '';
    return this.isNonEmpty(this.productReference()) ? '' : this.t('onboarding.errors.productReferenceRequired');
  });

  protected readonly productPriceError = computed(() => {
    if (!this.shouldShowErrors(this.productStep())) return '';
    if (this.productSkipped()) return '';
    const price = this.productPrice();
    return price !== null && price > 0 ? '' : this.t('onboarding.errors.productPriceRequired');
  });

  protected readonly productVatRateError = computed(() => {
    if (!this.shouldShowErrors(this.productStep())) return '';
    if (this.productSkipped()) return '';
    return this.productVatRateId() ? '' : this.t('onboarding.errors.productVatRequired');
  });

  protected readonly productTypeError = computed(() => {
    if (!this.shouldShowErrors(this.productStep())) return '';
    if (this.productSkipped()) return '';
    return this.productType() ? '' : this.t('onboarding.errors.productTypeRequired');
  });

  protected readonly intakeExamples = computed(() => [
    {
      title: this.t('onboarding.intakeExamples.windows.title'),
      content: this.t('onboarding.intakeExamples.windows.content'),
    },
    {
      title: this.t('onboarding.intakeExamples.insulation.title'),
      content: this.t('onboarding.intakeExamples.insulation.content'),
    },
    {
      title: this.t('onboarding.intakeExamples.electrical.title'),
      content: this.t('onboarding.intakeExamples.electrical.content'),
    },
  ]);

  protected readonly productTypeOptions = computed<SelectOption<ProductType>[]>(() => [
    { label: this.t('onboarding.product.type.service'), value: 'service' },
    { label: this.t('onboarding.product.type.digital'), value: 'digital_service' },
    { label: this.t('onboarding.product.type.product'), value: 'product' },
    { label: this.t('onboarding.product.type.material'), value: 'material' },
  ]);

  protected readonly vatRateOptions = computed(() =>
    this.vatRates().map(rate => ({
      label: rate.name,
      value: rate.id,
    }))
  );

  private readonly router = inject(Router);
  private readonly userService = inject(UserService);
  private readonly authService = inject(AuthService);
  private readonly serviceTypesService = inject(ServiceTypesService);
  private readonly orgService = inject(OrganizationService);
  private readonly catalogService = inject(CatalogService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);
  private readonly lang = toSignal(this.translate.onLangChange, {
    initialValue: { lang: 'nl', translations: {} },
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.revokeQrUrl();
      this.stopQrRefreshCycle();
    });
    this.loadDefaults();
    this.setupSmtpAutoDetect();
  }

  private setupSmtpAutoDetect(): void {
    toObservable(this.smtpFromEmail)
      .pipe(
        debounceTime(600),
        distinctUntilChanged(),
        filter(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())),
        switchMap(email => {
          this.isSmtpDetecting.set(true);
          this.smtpDetectedProvider.set('');
          this.smtpDetectionFailed.set(false);
          this.smtpDetectedHost.set('');
          this.smtpDetectedPort.set(null);
          // Pre-fill username with the email address.
          if (!this.smtpUsername().trim()) {
            this.smtpUsername.set(email.trim());
          }
          return this.orgService.detectSMTP(email.trim()).pipe(
            catchError(() => {
              this.smtpDetectedProvider.set('');
              this.smtpDetectionFailed.set(true);
              this.showSmtpAdvanced.set(true);
              return EMPTY;
            }),
            finalize(() => this.isSmtpDetecting.set(false))
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(result => {
        if (!result.detected || !result.host) {
          this.smtpDetectionFailed.set(true);
          this.showSmtpAdvanced.set(true);
          return;
        }
        this.smtpDetectionFailed.set(false);
        if (result.provider) this.smtpDetectedProvider.set(result.provider);
        if (result.host) {
          this.smtpHost.set(result.host);
          this.smtpDetectedHost.set(result.host);
        }
        if (result.port) {
          this.smtpPort.set(result.port);
          this.smtpDetectedPort.set(result.port);
        }
        if (result.username) this.smtpUsername.set(result.username);
        this.showSmtpAdvanced.set(false);
      });
  }

  private loadDefaults(): void {
    void this.resolveDefaults();
  }

  private async resolveDefaults(): Promise<void> {
    const profile = await firstValueFrom(
      this.userService.getProfile().pipe(catchError(() => of(null)))
    );
    if (!profile) {
      return;
    }

    if (profile.firstName) {
      this.firstName.set(profile.firstName);
    }
    if (profile.lastName) {
      this.lastName.set(profile.lastName);
    }

    // Check if user needs to create an organization
    this.needsOrganization.set(!profile.hasOrganization);
    if (!this.needsOrganization()) {
      this.currentStep.set(1);
    }
    if (this.needsOrganization() && !this.isNonEmpty(this.country())) {
      this.country.set('Nederland');
    }

    // Only redirect if onboarding has been fully completed
    if (profile.onboardingCompleted) {
      await this.router.navigate(['/app']);
      return;
    }

    // If org already exists (e.g. page refresh mid-onboarding), skip org steps
    if (profile.firstName && profile.lastName && profile.hasOrganization) {
      this.onboardingPersisted.set(true);
      this.currentStep.set(this.smtpStep() === -1 ? this.whatsAppStep() : this.smtpStep());
    }
  }

  protected handleSubmit(): void {
    this.globalError.set('');
    this.stepAttempted.set(true);

    if (this.currentStep() === this.smtpStep()) {
      void this.submitSmtpStep();
      return;
    }

    if (this.currentStep() === this.whatsAppStep()) {
      this.advanceStep();
      return;
    }

    if (this.currentStep() === this.serviceTypeStep()) {
      void this.submitServiceTypeStep();
      return;
    }

    if (this.currentStep() === this.productStep()) {
      void this.submitProductStep();
      return;
    }

    if (!this.canProceed()) {
      return;
    }

    if (this.currentStep() < this.totalSteps()) {
      if (this.needsOrganization() && this.currentStep() === 3 && !this.onboardingPersisted()) {
        void this.persistAndAdvance();
        return;
      }
      this.advanceStep();
      return;
    }

    void this.finishOnboarding();
  }

  protected handleSmtpSkip(): void {
    if (this.isSmtpSaving()) return;
    this.smtpSkipped.set(true);
    this.smtpErrorMessage.set('');
    this.advanceStep();
  }

  protected handleWhatsAppSkip(): void {
    if (this.isWhatsAppAction()) return;
    this.whatsAppSkipped.set(true);
    this.advanceStep();
  }

  protected handleServiceTypeSkip(): void {
    if (this.serviceTypeCreating() || this.isSaving()) return;
    this.serviceTypeSkipped.set(true);
    this.serviceTypeError.set('');
    this.stepAttempted.set(false);
    this.advanceStep();
  }

  protected handleProductSkip(): void {
    if (this.productCreating() || this.isSaving()) return;
    this.productSkipped.set(true);
    this.productError.set('');
    this.stepAttempted.set(false);
    void this.finishOnboarding();
  }

  protected goBack(): void {
    if (this.currentStep() <= 1) return;
    this.currentStep.update(step => step - 1);
    this.stepAttempted.set(false);
    this.globalError.set('');
  }

  private async submitServiceTypeStep(): Promise<void> {
    if (!this.canProceed()) return;
    if (this.serviceTypeSkipped()) {
      this.advanceStep();
      return;
    }
    if (this.serviceTypeCreating()) return;

    this.serviceTypeCreating.set(true);
    this.serviceTypeError.set('');

    try {
      const request: CreateServiceTypeRequest = {
        name: this.serviceTypeName().trim(),
        intakeGuidelines: this.intakeGuidelines().trim(),
      };

      const description = this.normalizeOptional(this.serviceTypeDescription());
      if (description) {
        request.description = description;
      }

      const icon = this.normalizeOptional(this.serviceTypeIcon() ?? '');
      if (icon) {
        request.icon = icon;
      }

      const color = this.normalizeOptional(this.serviceTypeColor());
      if (color) {
        request.color = color;
      }

      await firstValueFrom(this.serviceTypesService.create(request));
      this.advanceStep();
    } catch {
      this.serviceTypeError.set(this.t('onboarding.errors.serviceCreateFailed'));
    } finally {
      this.serviceTypeCreating.set(false);
    }
  }

  private async submitProductStep(): Promise<void> {
    if (!this.canProceed()) return;
    if (this.productSkipped()) {
      void this.finishOnboarding();
      return;
    }
    if (this.productCreating()) return;

    this.productCreating.set(true);
    this.productError.set('');

    try {
      const price = this.productPrice();
      const vatRateId = this.productVatRateId();
      const type = this.productType();
      if (!price || !vatRateId || !type) {
        this.productError.set(this.t('onboarding.errors.productFieldsRequired'));
        return;
      }

      await firstValueFrom(
        this.catalogService.createProduct({
          title: this.productTitle().trim(),
          reference: this.productReference().trim(),
          priceCents: CatalogService.priceToCents(price),
          vatRateId,
          type,
        })
      );
      void this.finishOnboarding();
    } catch {
      this.productError.set(this.t('onboarding.errors.productCreateFailed'));
    } finally {
      this.productCreating.set(false);
    }
  }

  private async finishOnboarding(): Promise<void> {
    if (this.onboardingPersisted()) {
      try {
        await firstValueFrom(this.userService.markOnboardingComplete());
      } catch {
        this.globalError.set(this.t('onboarding.errors.saveFailed'));
        return;
      }
      await this.router.navigate(['/app']);
      return;
    }
    await this.persistOnboarding(true);
  }

  private async persistAndAdvance(): Promise<void> {
    if (this.isSaving()) return;
    this.globalError.set('');
    this.isSaving.set(true);

    const success = await this.persistOnboarding(false);
    this.isSaving.set(false);
    if (!success) return;
    this.advanceStep();
  }

  private async persistOnboarding(shouldNavigate: boolean): Promise<boolean> {
    try {
      const payload: CompleteOnboardingRequest = {
        firstName: this.firstName().trim(),
        lastName: this.lastName().trim(),
      };

      if (this.needsOrganization()) {
        Object.assign(
          payload,
          this.optionalField('organizationName', this.organizationName()),
          this.optionalField('organizationEmail', this.organizationEmail()),
          this.optionalField('organizationPhone', this.organizationPhone()),
          this.optionalField('vatNumber', this.vatNumber()),
          this.optionalField('kvkNumber', this.kvkNumber()),
          this.optionalField('addressLine1', this.addressLine1()),
          this.optionalField('addressLine2', this.addressLine2()),
          this.optionalField('postalCode', this.postalCode()),
          this.optionalField('city', this.city()),
          this.optionalField('country', this.country())
        );
      }

      await firstValueFrom(this.userService.completeOnboarding(payload));
      await firstValueFrom(this.authService.refresh());
      this.onboardingPersisted.set(true);
      if (shouldNavigate) {
        await firstValueFrom(this.userService.markOnboardingComplete());
        await this.router.navigate(['/app']);
      }
      return true;
    } catch {
      this.globalError.set(this.t('onboarding.errors.saveFailed'));
      return false;
    } finally {
      if (shouldNavigate) {
        this.isSaving.set(false);
      }
    }
  }

  private hasName(): boolean {
    return this.isNonEmpty(this.firstName()) && this.isNonEmpty(this.lastName());
  }

  private hasOrganizationBasics(): boolean {
    if (!this.needsOrganization()) return true;
    const hasName = this.isNonEmpty(this.organizationName());
    const hasEmail = this.isNonEmpty(this.organizationEmail()) && this.isEmailValid(this.organizationEmail());
    const hasPhone = this.isNonEmpty(this.organizationPhone()) && this.isPhoneValid(this.organizationPhone());
    return hasName && hasEmail && hasPhone;
  }

  private hasValidBusinessDetails(): boolean {
    if (!this.needsOrganization()) return true;
    const vatOk = !this.isNonEmpty(this.vatNumber()) || this.isVatValid(this.vatNumber());
    const kvkOk = !this.isNonEmpty(this.kvkNumber()) || this.isKvkValid(this.kvkNumber());
    const postalOk = !this.isNonEmpty(this.postalCode()) || this.isPostalCodeValid(this.postalCode());
    return vatOk && kvkOk && postalOk;
  }

  private canProceedServiceType(): boolean {
    if (this.serviceTypeSkipped()) return true;
    return this.isNonEmpty(this.serviceTypeName()) && this.isNonEmpty(this.intakeGuidelines());
  }

  private canProceedProduct(): boolean {
    if (this.productSkipped()) return true;
    const price = this.productPrice();
    return (
      this.isNonEmpty(this.productTitle()) &&
      this.isNonEmpty(this.productReference()) &&
      typeof price === 'number' &&
      price > 0 &&
      !!this.productVatRateId() &&
      !!this.productType()
    );
  }

  private shouldShowErrors(step: number): boolean {
    return this.stepAttempted() && this.currentStep() === step;
  }

  private normalizeOptional(value: string): string | undefined {
    const trimmed = value.trim();
    return trimmed || undefined;
  }

  private t(key: string): string {
    this.lang();
    return this.translate.instant(key);
  }

  private optionalField<K extends keyof CompleteOnboardingRequest>(
    key: K,
    value: string
  ): Partial<CompleteOnboardingRequest> {
    const normalized = this.normalizeOptional(value);
    if (!normalized) {
      return {};
    }
    return { [key]: normalized } as Partial<CompleteOnboardingRequest>;
  }

  private isNonEmpty(value: string): boolean {
    return value.trim().length > 0;
  }

  private isEmailValid(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  }

  private isPhoneValid(value: string): boolean {
    return /^[+()\d\s.-]{7,}$/.test(value.trim());
  }

  private isVatValid(value: string): boolean {
    return /^NL\d{9}B\d{2}$/i.test(value.trim());
  }

  private isKvkValid(value: string): boolean {
    return /^\d{8}$/.test(value.trim());
  }

  private isPostalCodeValid(value: string): boolean {
    return /^\d{4}\s?[A-Za-z]{2}$/.test(value.trim());
  }

  protected readonly isWhatsAppConnected = computed(() => this.whatsAppStatus()?.state === 'CONNECTED');
  protected readonly isWhatsAppUnregistered = computed(() => !this.whatsAppDeviceId());
  protected readonly qrUrl = computed(() => this.qrBlobUrl() ?? '');
  protected readonly whatsAppStateLabel = computed(() => {
    const state = this.whatsAppStatus()?.state;
    switch (state) {
      case 'CONNECTED':
        return this.t('onboarding.whatsapp.states.connected');
      case 'DISCONNECTED':
        return this.t('onboarding.whatsapp.states.disconnected');
      case 'ERROR':
        return this.t('onboarding.whatsapp.states.error');
      case 'UNREGISTERED':
      default:
        return this.t('onboarding.whatsapp.states.unregistered');
    }
  });

  private advanceStep(): void {
    this.currentStep.update(step => step + 1);
    this.stepAttempted.set(false);
    this.globalError.set('');
    if (this.currentStep() === this.smtpStep()) {
      this.enterSmtpStep();
    }
    if (this.currentStep() === this.whatsAppStep()) {
      this.enterWhatsAppStep();
    }
    if (this.currentStep() === this.productStep()) {
      this.enterProductStep();
    }
  }

  private enterProductStep(): void {
    this.productError.set('');
    this.loadVatRates();
  }

  private loadVatRates(): void {
    this.vatRatesLoading.set(true);
    this.catalogService
      .listVatRates({ page: 1, pageSize: 50, sortBy: 'rateBps', sortOrder: 'desc' })
      .pipe(
        catchError(() => {
          this.productError.set(this.t('onboarding.errors.vatRatesLoadFailed'));
          return EMPTY;
        }),
        finalize(() => this.vatRatesLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(response => {
        this.vatRates.set(response.items ?? []);
        if (!this.productVatRateId() && response.items?.length) {
          this.productVatRateId.set(response.items[0]?.id ?? null);
        }
      });
  }

  private enterWhatsAppStep(): void {
    this.whatsAppErrorMessage.set('');
    this.whatsAppSuccessMessage.set('');
    this.loadWhatsAppSettings();
  }

  private loadWhatsAppSettings(): void {
    this.isWhatsAppLoading.set(true);

    this.orgService
      .getSettings()
      .pipe(
        catchError(() => {
          this.whatsAppErrorMessage.set(this.t('onboarding.errors.whatsappSettingsFailed'));
          return EMPTY;
        }),
        finalize(() => this.isWhatsAppLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(settings => {
        this.whatsAppDeviceId.set(settings.whatsAppDeviceId ?? null);
        this.loadWhatsAppStatus();
        this.startStatusPolling();
      });
  }

  private startStatusPolling(): void {
    if (this.statusPollingStarted) return;
    this.statusPollingStarted = true;

    timer(0, 5000)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(() => EMPTY)
      )
      .subscribe(() => this.loadWhatsAppStatus());
  }

  private loadWhatsAppStatus(): void {
    this.isWhatsAppLoading.set(true);
    this.whatsAppErrorMessage.set('');

    this.orgService
      .getWhatsAppStatus()
      .pipe(
        catchError(() => {
          this.whatsAppErrorMessage.set(this.t('onboarding.errors.whatsappStatusFailed'));
          return EMPTY;
        }),
        finalize(() => this.isWhatsAppLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(status => {
        const prev = this.whatsAppStatus();
        this.whatsAppStatus.set(status);

        if (status.state === 'CONNECTED') {
          this.stopQrRefreshCycle();
          this.revokeQrUrl();
          return;
        }

        if (status.needsReauth && !prev?.needsReauth) {
          this.startQrRefreshCycle();
        }
      });
  }

  protected connectWhatsApp(): void {
    if (this.isWhatsAppAction()) return;

    this.isWhatsAppAction.set(true);
    this.whatsAppErrorMessage.set('');
    this.whatsAppSuccessMessage.set('');

    this.orgService
      .registerWhatsAppDevice()
      .pipe(
        catchError(() => {
          this.whatsAppErrorMessage.set(this.t('onboarding.errors.whatsappRegisterFailed'));
          return EMPTY;
        }),
        finalize(() => this.isWhatsAppAction.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(response => {
        this.whatsAppDeviceId.set(response.deviceId);
        this.whatsAppSuccessMessage.set(this.t('onboarding.whatsapp.registered'));
        this.refreshQr();
        this.loadWhatsAppStatus();
      });
  }

  protected reconnectWhatsApp(): void {
    if (this.isWhatsAppAction() || this.isWhatsAppUnregistered()) return;

    this.isWhatsAppAction.set(true);
    this.whatsAppErrorMessage.set('');
    this.whatsAppSuccessMessage.set('');

    this.orgService
      .reconnectWhatsApp()
      .pipe(
        catchError(() => {
          this.whatsAppErrorMessage.set(this.t('onboarding.errors.whatsappReconnectFailed'));
          return EMPTY;
        }),
        finalize(() => this.isWhatsAppAction.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.whatsAppSuccessMessage.set(this.t('onboarding.whatsapp.reconnectStarted'));
        this.refreshQr();
        this.loadWhatsAppStatus();
      });
  }

  protected refreshQr(): void {
    this.stopQrRefreshCycle();
    this.startQrRefreshCycle();
  }

  private startQrRefreshCycle(): void {
    if (this.qrRefreshSub) return;
    this.qrRefreshSub = timer(0, 20_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadWhatsAppQr());
  }

  private stopQrRefreshCycle(): void {
    this.qrRefreshSub?.unsubscribe();
    this.qrRefreshSub = null;
  }

  private loadWhatsAppQr(): void {
    if (this.isWhatsAppUnregistered() || this.qrLoadInFlight) return;

    this.qrLoadInFlight = true;

    this.orgService
      .getWhatsAppQr()
      .pipe(
        catchError(() => {
          this.whatsAppErrorMessage.set(this.t('onboarding.errors.whatsappQrFailed'));
          return EMPTY;
        }),
        finalize(() => (this.qrLoadInFlight = false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(blob => this.setQrUrl(blob));
  }

  private setQrUrl(blob: Blob): void {
    this.revokeQrUrl();
    const url = URL.createObjectURL(blob);
    this.qrBlobUrl.set(url);
  }

  private revokeQrUrl(): void {
    const current = this.qrBlobUrl();
    if (!current) return;
    URL.revokeObjectURL(current);
    this.qrBlobUrl.set(null);
  }

  // ── SMTP onboarding methods ──

  private enterSmtpStep(): void {
    this.smtpErrorMessage.set('');
    this.smtpSuccessMessage.set('');
  }

  private async submitSmtpStep(): Promise<void> {
    if (this.smtpSkipped()) {
      this.advanceStep();
      return;
    }

    if (!this.canSaveSMTP()) {
      this.advanceStep();
      return;
    }

    this.isSmtpSaving.set(true);
    this.smtpErrorMessage.set('');
    this.smtpSuccessMessage.set('');

    try {
      await firstValueFrom(
        this.orgService.setSMTP({
          host: this.smtpHost().trim(),
          port: this.smtpPort() ?? 587,
          username: this.smtpUsername().trim(),
          password: this.smtpPassword().trim(),
          fromEmail: this.smtpFromEmail().trim(),
          fromName: this.smtpFromName().trim(),
        })
      );
      this.smtpSuccessMessage.set(this.t('onboarding.smtp.saved'));
      this.advanceStep();
    } catch {
      this.smtpErrorMessage.set(this.t('onboarding.errors.smtpSaveFailed'));
    } finally {
      this.isSmtpSaving.set(false);
    }
  }
}
