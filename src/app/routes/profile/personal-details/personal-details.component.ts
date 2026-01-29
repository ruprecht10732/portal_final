import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, finalize } from 'rxjs';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { UserService } from '../../../core/services/user.service';

@Component({
  selector: 'app-personal-details',
  imports: [ButtonComponent, InputComponent],
  templateUrl: './personal-details.component.html',
  styleUrl: './personal-details.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonalDetailsComponent {
  protected readonly email = signal('');
  protected readonly emailVerified = signal(false);
  protected readonly createdAt = signal('');
  protected readonly updatedAt = signal('');

  protected readonly isLoading = signal(true);
  protected readonly isSaving = signal(false);
  protected readonly successMessage = signal('');
  protected readonly errorMessage = signal('');

  private readonly userService = inject(UserService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly emailError = computed(() => {
    const value = this.email();
    if (!value) return 'Email is required';
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    return isValid ? '' : 'Enter a valid email address';
  });

  protected readonly canSave = computed(() =>
    !this.isSaving() && !this.emailError() && !!this.email()
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

  protected save(): void {
    if (!this.canSave()) return;
    this.successMessage.set('');
    this.errorMessage.set('');
    this.isSaving.set(true);

    this.userService
      .updateProfile({ email: this.email() })
      .pipe(
        catchError(error => {
          this.errorMessage.set(this.normalizeError(error));
          return EMPTY;
        }),
        finalize(() => this.isSaving.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(profile => {
        this.email.set(profile.email);
        this.emailVerified.set(profile.emailVerified);
        this.updatedAt.set(profile.updatedAt);
        this.successMessage.set('Profile updated. Check your email to verify changes.');
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
