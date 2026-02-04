import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, firstValueFrom, of } from 'rxjs';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { InputComponent } from '../../shared/components/input/input.component';
import { UserService } from '../../core/services/user.service';

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
  protected readonly needsOrganization = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly globalError = signal('');

  protected readonly canSubmit = computed(() => {
    if (this.isSaving()) return false;
    const hasName = !!this.firstName().trim() && !!this.lastName().trim();
    const hasOrg = !this.needsOrganization() || !!this.organizationName().trim();
    return hasName && hasOrg;
  });

  private readonly router = inject(Router);
  private readonly userService = inject(UserService);

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

    // Only redirect if all onboarding is complete
    if (profile.firstName && profile.lastName && profile.hasOrganization) {
      await this.router.navigate(['/app']);
    }
  }

  protected save(): void {
    if (!this.canSubmit()) return;

    this.globalError.set('');
    this.isSaving.set(true);

    void this.persistOnboarding();
  }

  private async persistOnboarding(): Promise<void> {
    try {
      const orgName = this.needsOrganization() ? this.organizationName().trim() : undefined;
      await firstValueFrom(
        this.userService.completeOnboarding({
          firstName: this.firstName().trim(),
          lastName: this.lastName().trim(),
          ...(orgName !== undefined && { organizationName: orgName }),
        })
      );

      await this.router.navigate(['/app']);
    } catch {
      this.globalError.set('Failed to save onboarding details.');
    } finally {
      this.isSaving.set(false);
    }
  }
}
