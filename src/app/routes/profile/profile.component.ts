import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, finalize } from 'rxjs';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { InputComponent } from '../../shared/components/input/input.component';
import { UserService } from '../../core/services/user.service';

@Component({
  selector: 'app-profile',
  imports: [ButtonComponent, InputComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileComponent {
  protected readonly email = signal('');
  protected readonly emailVerified = signal(false);
  protected readonly createdAt = signal('');
  protected readonly updatedAt = signal('');

  protected readonly currentPassword = signal('');
  protected readonly newPassword = signal('');
  protected readonly confirmPassword = signal('');

  protected readonly isLoading = signal(true);
  protected readonly isSavingProfile = signal(false);
  protected readonly isSavingPassword = signal(false);
  protected readonly profileMessage = signal('');
  protected readonly passwordMessage = signal('');
  protected readonly errorMessage = signal('');

  private readonly userService = inject(UserService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly emailError = computed(() => {
    const value = this.email();
    if (!value) return 'Email is required';
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    return isValid ? '' : 'Enter a valid email address';
  });

  protected readonly newPasswordError = computed(() => {
    const value = this.newPassword();
    if (!value) return '';
    return value.length >= 8 ? '' : 'Password must be at least 8 characters';
  });

  protected readonly confirmPasswordError = computed(() => {
    if (!this.confirmPassword()) return '';
    return this.newPassword() === this.confirmPassword() ? '' : 'Passwords do not match';
  });

  protected readonly canSaveProfile = computed(() =>
    !this.isSavingProfile() && !this.emailError() && !!this.email()
  );

  protected readonly canSavePassword = computed(() =>
    !this.isSavingPassword() &&
    !!this.currentPassword() &&
    !!this.newPassword() &&
    !this.newPasswordError() &&
    !!this.confirmPassword() &&
    !this.confirmPasswordError()
  );

  constructor() {
    this.loadProfile();
  }

  protected loadProfile(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.userService
      .getProfile()
      .pipe(
        catchError(error => {
          this.errorMessage.set(this.normalizeError(error));
          return EMPTY;
        }),
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(profile => {
        this.email.set(profile.email);
        this.emailVerified.set(profile.emailVerified);
        this.createdAt.set(profile.createdAt);
        this.updatedAt.set(profile.updatedAt);
      });
  }

  protected saveProfile(): void {
    if (!this.canSaveProfile()) return;
    this.profileMessage.set('');
    this.errorMessage.set('');
    this.isSavingProfile.set(true);

    this.userService
      .updateProfile({ email: this.email() })
      .pipe(
        catchError(error => {
          this.errorMessage.set(this.normalizeError(error));
          return EMPTY;
        }),
        finalize(() => this.isSavingProfile.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(profile => {
        this.email.set(profile.email);
        this.emailVerified.set(profile.emailVerified);
        this.updatedAt.set(profile.updatedAt);
        this.profileMessage.set('Profile updated. Check your email to verify changes.');
      });
  }

  protected savePassword(): void {
    if (!this.canSavePassword()) return;
    this.passwordMessage.set('');
    this.errorMessage.set('');
    this.isSavingPassword.set(true);

    this.userService
      .changePassword({
        currentPassword: this.currentPassword(),
        newPassword: this.newPassword(),
      })
      .pipe(
        catchError(error => {
          this.errorMessage.set(this.normalizeError(error));
          return EMPTY;
        }),
        finalize(() => this.isSavingPassword.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.currentPassword.set('');
        this.newPassword.set('');
        this.confirmPassword.set('');
        this.passwordMessage.set('Password updated.');
      });
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
    return 'Something went wrong. Please try again.';
  }
}
