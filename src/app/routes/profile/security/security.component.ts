import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, finalize } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { UserService } from '../../../core/services/user.service';
import { MIN_LENGTH } from '../../../core/config';

@Component({
  selector: 'app-security',
  imports: [ButtonComponent, InputComponent, TranslateModule],
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
  private readonly translate = inject(TranslateService);
  private readonly lang = toSignal(this.translate.onLangChange, {
    initialValue: { lang: 'en', translations: {} },
  });

  protected readonly newPasswordError = computed(() => {
    this.lang();
    const value = this.newPassword();
    if (!value) return '';
    return value.length >= MIN_LENGTH.password
      ? ''
      : this.translate.instant('profile.securityPage.errors.minPassword', { count: MIN_LENGTH.password });
  });

  protected readonly confirmPasswordError = computed(() => {
    this.lang();
    if (!this.confirmPassword()) return '';
    return this.newPassword() === this.confirmPassword()
      ? ''
      : this.translate.instant('profile.securityPage.errors.passwordsNoMatch');
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
        this.successMessage.set(this.translate.instant('profile.securityPage.success'));
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
    return this.translate.instant('profile.securityPage.errors.generic');
  }
}
