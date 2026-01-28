import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { InputComponent } from '../../../shared/components/input/input.component';

interface PasswordRule {
  label: string;
  met: boolean;
}

@Component({
  selector: 'auth-reset-password',
  imports: [RouterLink, ButtonComponent, InputComponent],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordComponent {
  protected readonly password = signal('');
  protected readonly confirmPassword = signal('');
  protected readonly isSubmitting = signal(false);

  private submitTimeoutId: number | null = null;
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly token = toSignal(
    this.route.queryParamMap.pipe(map(params => params.get('token'))),
    { initialValue: null }
  );

  protected readonly isTokenValid = computed(() => !!this.token());

  protected readonly hasMinLength = computed(() => this.password().length >= 8);
  protected readonly hasNumber = computed(() => /\d/.test(this.password()));
  protected readonly hasUppercase = computed(() => /[A-Z]/.test(this.password()));
  protected readonly hasSpecial = computed(() => /[^A-Za-z0-9]/.test(this.password()));

  protected readonly passwordRules = computed<PasswordRule[]>(() => [
    { label: 'At least 8 characters', met: this.hasMinLength() },
    { label: 'Contains a number', met: this.hasNumber() },
    { label: 'Contains an uppercase letter', met: this.hasUppercase() },
    { label: 'Contains a special character', met: this.hasSpecial() },
  ]);

  protected readonly passwordError = computed(() => {
    const value = this.password();
    if (!value) return '';
    return this.hasMinLength() ? '' : 'Password must be at least 8 characters';
  });

  protected readonly confirmError = computed(() => {
    if (!this.confirmPassword()) return '';
    return this.confirmPassword() === this.password() ? '' : 'Passwords do not match';
  });

  protected readonly canSubmit = computed(() =>
    this.isTokenValid() && !this.isSubmitting() && !!this.password() && !this.passwordError() && !this.confirmError()
  );

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.submitTimeoutId !== null) {
        globalThis.clearTimeout(this.submitTimeoutId);
      }
    });
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    if (!this.canSubmit()) return;

    this.isSubmitting.set(true);
    if (this.submitTimeoutId !== null) {
      globalThis.clearTimeout(this.submitTimeoutId);
    }

    this.submitTimeoutId = globalThis.setTimeout(() => {
      this.isSubmitting.set(false);
      this.router.navigate(['/sign-in']);
    }, 1200);
  }
}
