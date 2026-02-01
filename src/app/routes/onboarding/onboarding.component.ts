import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, firstValueFrom, of } from 'rxjs';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { InputComponent } from '../../shared/components/input/input.component';
import { OrganizationService } from '../../core/services/organization.service';
import { UserService } from '../../core/services/user.service';

@Component({
  selector: 'app-onboarding',
  imports: [ButtonComponent, InputComponent],
  templateUrl: './onboarding.component.html',
  styleUrl: './onboarding.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnboardingComponent {
  protected readonly organizationName = signal('');
  protected readonly organizationEmail = signal('');
  protected readonly organizationPhone = signal('');
  protected readonly organizationVat = signal('');
  protected readonly organizationKvk = signal('');
  protected readonly organizationAddressLine1 = signal('');
  protected readonly organizationAddressLine2 = signal('');
  protected readonly organizationPostalCode = signal('');
  protected readonly organizationCity = signal('');
  protected readonly organizationCountry = signal('');
  protected readonly firstName = signal('');
  protected readonly lastName = signal('');
  protected readonly inviteEmail = signal('');
  protected readonly isSaving = signal(false);
  protected readonly globalError = signal('');
  protected readonly inviteStatus = signal('');
  protected readonly isAdmin = signal(false);

  protected readonly organizationEmailError = computed(() => {
    const value = this.organizationEmail().trim();
    if (!value) return '';
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    return isValid ? '' : 'Enter a valid organization email';
  });

  protected readonly organizationVatError = computed(() => {
    const value = this.organizationVat().trim();
    if (!value) return '';
    return /^NL\d{9}B\d{2}$/i.test(value) ? '' : 'Invalid VAT number';
  });

  protected readonly organizationKvkError = computed(() => {
    const value = this.organizationKvk().trim();
    if (!value) return '';
    return /^\d{8}$/.test(value) ? '' : 'Invalid KVK number';
  });

  private readonly router = inject(Router);
  private readonly orgService = inject(OrganizationService);
  private readonly userService = inject(UserService);

  protected readonly canSubmit = computed(() => {
    if (this.isSaving()) return false;
    if (!this.firstName().trim() || !this.lastName().trim()) return false;
    if (this.isAdmin() && !this.organizationName().trim()) return false;
    if (this.organizationEmailError() || this.organizationVatError() || this.organizationKvkError()) return false;
    return true;
  });

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

    const isAdmin = this.applyProfileDefaults(profile);
    const org = await this.loadOrganizationDefaults(isAdmin);

    if (this.isOnboardingComplete(profile, isAdmin, org)) {
      await this.router.navigate(['/app']);
    }
  }

  private applyProfileDefaults(profile: { roles: string[]; firstName: string | null; lastName: string | null }): boolean {
    const isAdmin = profile.roles.includes('admin');
    this.isAdmin.set(isAdmin);
    if (profile.firstName) {
      this.firstName.set(profile.firstName);
    }
    if (profile.lastName) {
      this.lastName.set(profile.lastName);
    }
    return isAdmin;
  }

  private async loadOrganizationDefaults(isAdmin: boolean): Promise<
    | {
        name?: string;
        email?: string;
        phone?: string;
        vatNumber?: string;
        kvkNumber?: string;
        addressLine1?: string;
        addressLine2?: string;
        postalCode?: string;
        city?: string;
        country?: string;
      }
    | null
  > {
    if (!isAdmin) return null;

    const org = await firstValueFrom(this.orgService.getOrganization().pipe(catchError(() => of(null))));
    if (!org) return null;

    this.organizationName.set(org.name ?? '');
    this.organizationEmail.set(org.email ?? '');
    this.organizationPhone.set(org.phone ?? '');
    this.organizationVat.set(org.vatNumber ?? '');
    this.organizationKvk.set(org.kvkNumber ?? '');
    this.organizationAddressLine1.set(org.addressLine1 ?? '');
    this.organizationAddressLine2.set(org.addressLine2 ?? '');
    this.organizationPostalCode.set(org.postalCode ?? '');
    this.organizationCity.set(org.city ?? '');
    this.organizationCountry.set(org.country ?? '');

    return org;
  }

  private isOnboardingComplete(
    profile: { firstName: string | null; lastName: string | null },
    isAdmin: boolean,
    org: { name?: string } | null
  ): boolean {
    return !!profile.firstName && !!profile.lastName && (!isAdmin || !!org?.name);
  }

  protected save(): void {
    if (!this.canSubmit()) return;

    this.globalError.set('');
    this.inviteStatus.set('');
    this.isSaving.set(true);

    void this.persistOnboarding();
  }

  private async persistOnboarding(): Promise<void> {
    try {
      if (this.isAdmin()) {
        const payload = this.buildOrganizationPayload();
        await firstValueFrom(
          this.orgService.updateOrganization(payload).pipe(
            catchError(() => of(null))
          )
        );
      }

      await firstValueFrom(
        this.userService.updateProfile({
          firstName: this.firstName().trim(),
          lastName: this.lastName().trim(),
        })
      );

      const inviteEmail = this.inviteEmail().trim();
      if (inviteEmail && this.isAdmin()) {
        await firstValueFrom(this.orgService.createInvite({ email: inviteEmail }));
        this.inviteStatus.set('Invite sent.');
      }

      await this.router.navigate(['/app']);
    } catch {
      this.globalError.set('Failed to save onboarding details.');
    } finally {
      this.isSaving.set(false);
    }
  }

  private buildOrganizationPayload() {
    const payload: {
      name: string;
      email?: string;
      phone?: string;
      vatNumber?: string;
      kvkNumber?: string;
      addressLine1?: string;
      addressLine2?: string;
      postalCode?: string;
      city?: string;
      country?: string;
    } = {
      name: this.organizationName().trim(),
    };

    const email = this.organizationEmail().trim();
    if (email) payload.email = email;
    const phone = this.organizationPhone().trim();
    if (phone) payload.phone = phone;
    const vat = this.organizationVat().trim();
    if (vat) payload.vatNumber = vat.toUpperCase();
    const kvk = this.organizationKvk().trim();
    if (kvk) payload.kvkNumber = kvk;
    const line1 = this.organizationAddressLine1().trim();
    if (line1) payload.addressLine1 = line1;
    const line2 = this.organizationAddressLine2().trim();
    if (line2) payload.addressLine2 = line2;
    const postal = this.organizationPostalCode().trim();
    if (postal) payload.postalCode = postal;
    const city = this.organizationCity().trim();
    if (city) payload.city = city;
    const country = this.organizationCountry().trim();
    if (country) payload.country = country;

    return payload;
  }
}
