import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, finalize } from 'rxjs';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { UserService } from '../../../core/services/user.service';
import { MIN_LENGTH } from '../../../core/config';

@Component({
  selector: 'app-security',
  imports: [ButtonComponent, InputComponent],
  templateUrl: './security.component.html',
  styleUrl: './security.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SecurityComponent {
  protected readonly currentPassword = signal('');
  protected readonly newPassword = signal('');
  protected readonly confirmPassword = signal('');

  protected readonly isSaving = signal(false);
  protected readonly successMessage = signal('');
  protected readonly errorMessage = signal('');

  private readonly userService = inject(UserService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly newPasswordError = computed(() => {
    const value = this.newPassword();
    if (!value) return '';
    return value.length >= MIN_LENGTH.password ? '' : `Password must be at least ${MIN_LENGTH.password} characters`;
  });

  protected readonly confirmPasswordError = computed(() => {
    if (!this.confirmPassword()) return '';
    return this.newPassword() === this.confirmPassword() ? '' : 'Passwords do not match';
  });

  protected readonly canSave = computed(() =>
    !this.isSaving() &&
    !!this.currentPassword() &&
    !!this.newPassword() &&
    !this.newPasswordError() &&
    !!this.confirmPassword() &&
    !this.confirmPasswordError()
  );

  protected save(): void {
    if (!this.canSave()) return;
    this.successMessage.set('');
    this.errorMessage.set('');
    this.isSaving.set(true);

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
        finalize(() => this.isSaving.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.currentPassword.set('');
        this.newPassword.set('');
        this.confirmPassword.set('');
        this.successMessage.set('Password updated successfully.');
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
