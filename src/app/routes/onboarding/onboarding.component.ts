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
  protected readonly firstName = signal('');
  protected readonly lastName = signal('');
  protected readonly inviteEmail = signal('');
  protected readonly isSaving = signal(false);
  protected readonly globalError = signal('');
  protected readonly inviteStatus = signal('');
  protected readonly isAdmin = signal(false);

  private readonly router = inject(Router);
  private readonly orgService = inject(OrganizationService);
  private readonly userService = inject(UserService);

  protected readonly canSubmit = computed(() => {
    if (this.isSaving()) return false;
    if (!this.firstName().trim() || !this.lastName().trim()) return false;
    if (this.isAdmin() && !this.organizationName().trim()) return false;
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

    const isAdmin = profile.roles.includes('admin');
    this.isAdmin.set(isAdmin);

    const org = isAdmin
      ? await firstValueFrom(this.orgService.getOrganization().pipe(catchError(() => of(null))))
      : null;

    if (org?.name) {
      this.organizationName.set(org.name);
    }
    if (profile.firstName) {
      this.firstName.set(profile.firstName);
    }
    if (profile.lastName) {
      this.lastName.set(profile.lastName);
    }

    const isComplete = !!profile.firstName && !!profile.lastName && (!isAdmin || !!org?.name);
    if (isComplete) {
      await this.router.navigate(['/app']);
    }
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
        await firstValueFrom(
          this.orgService.updateOrganization({ name: this.organizationName().trim() }).pipe(
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
}
