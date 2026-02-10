import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, firstValueFrom, of } from 'rxjs';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { InputComponent } from '../../shared/components/input/input.component';
import { AuthService } from '../../core/services/auth.service';
import { UserService } from '../../core/services/user.service';
import type { CompleteOnboardingRequest } from '../../core/services/user.types';

@Component({
  selector: 'app-onboarding',
  imports: [ButtonComponent, InputComponent],
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
  protected readonly country = signal('Netherlands');
  protected readonly needsOrganization = signal(false);
  protected readonly currentStep = signal(1);
  protected readonly stepAttempted = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly globalError = signal('');

  protected readonly totalSteps = computed(() => (this.needsOrganization() ? 3 : 1));

  protected readonly stepTitle = computed(() => {
    if (this.currentStep() === 1) return 'Set up your profile';
    if (this.currentStep() === 2) return 'Company essentials';
    return 'Business details';
  });

  protected readonly stepSubtitle = computed(() => {
    if (this.currentStep() === 1) return 'Add your personal details to get started.';
    if (this.currentStep() === 2) return 'Tell us how clients can reach your company.';
    return 'Optional details that help with invoicing and quoting.';
  });

  protected readonly primaryLabel = computed(() =>
    this.currentStep() === this.totalSteps() ? 'Complete onboarding' : 'Continue'
  );

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
      return this.hasName();
    }
    if (this.currentStep() === 2) {
      return this.hasOrganizationBasics();
    }
    return this.hasValidBusinessDetails();
  });

  protected readonly firstNameError = computed(() =>
    this.shouldShowErrors(1) && !this.isNonEmpty(this.firstName()) ? 'First name is required.' : ''
  );
  protected readonly lastNameError = computed(() =>
    this.shouldShowErrors(1) && !this.isNonEmpty(this.lastName()) ? 'Last name is required.' : ''
  );
  protected readonly organizationNameError = computed(() => {
    if (!this.shouldShowErrors(2)) return '';
    if (!this.needsOrganization()) return '';
    return this.isNonEmpty(this.organizationName()) ? '' : 'Organization name is required.';
  });
  protected readonly organizationEmailError = computed(() => {
    if (!this.shouldShowErrors(2)) return '';
    if (!this.isNonEmpty(this.organizationEmail())) return 'Organization email is required.';
    return this.isEmailValid(this.organizationEmail()) ? '' : 'Enter a valid email.';
  });
  protected readonly organizationPhoneError = computed(() => {
    if (!this.shouldShowErrors(2)) return '';
    if (!this.isNonEmpty(this.organizationPhone())) return 'Organization phone is required.';
    return this.isPhoneValid(this.organizationPhone()) ? '' : 'Enter a valid phone number.';
  });
  protected readonly vatNumberError = computed(() => {
    if (!this.shouldShowErrors(3)) return '';
    if (!this.isNonEmpty(this.vatNumber())) return '';
    return this.isVatValid(this.vatNumber()) ? '' : 'Enter a valid VAT number (NL123456789B01).';
  });
  protected readonly kvkNumberError = computed(() => {
    if (!this.shouldShowErrors(3)) return '';
    if (!this.isNonEmpty(this.kvkNumber())) return '';
    return this.isKvkValid(this.kvkNumber()) ? '' : 'Enter a valid KvK number (8 digits).';
  });
  protected readonly postalCodeError = computed(() => {
    if (!this.shouldShowErrors(3)) return '';
    if (!this.isNonEmpty(this.postalCode())) return '';
    return this.isPostalCodeValid(this.postalCode()) ? '' : 'Enter a valid postal code (1234 AB).';
  });

  private readonly router = inject(Router);
  private readonly userService = inject(UserService);
  private readonly authService = inject(AuthService);

  constructor() {
    this.loadDefaults();
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
      this.country.set('Netherlands');
    }

    // Only redirect if all onboarding is complete
    if (profile.firstName && profile.lastName && profile.hasOrganization) {
      await this.router.navigate(['/app']);
    }
  }

  protected handleSubmit(): void {
    this.globalError.set('');
    this.stepAttempted.set(true);

    if (!this.canProceed()) {
      return;
    }

    if (this.currentStep() < this.totalSteps()) {
      this.currentStep.update(step => step + 1);
      this.stepAttempted.set(false);
      return;
    }

    this.save();
  }

  protected goBack(): void {
    if (this.currentStep() <= 1) return;
    this.currentStep.update(step => step - 1);
    this.stepAttempted.set(false);
    this.globalError.set('');
  }

  private save(): void {
    if (this.isSaving()) return;
    this.globalError.set('');
    this.isSaving.set(true);

    void this.persistOnboarding();
  }

  private async persistOnboarding(): Promise<void> {
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
      await this.router.navigate(['/app']);
    } catch {
      this.globalError.set('Failed to save onboarding details.');
    } finally {
      this.isSaving.set(false);
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

  private shouldShowErrors(step: number): boolean {
    return this.stepAttempted() && this.currentStep() === step;
  }

  private normalizeOptional(value: string): string | undefined {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
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
    return /^NL[0-9]{9}B[0-9]{2}$/i.test(value.trim());
  }

  private isKvkValid(value: string): boolean {
    return /^[0-9]{8}$/.test(value.trim());
  }

  private isPostalCodeValid(value: string): boolean {
    return /^[0-9]{4}\s?[A-Za-z]{2}$/.test(value.trim());
  }
}
