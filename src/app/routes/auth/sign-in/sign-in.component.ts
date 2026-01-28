import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { InputComponent } from '../../../shared/components/input/input.component';

@Component({
  selector: 'auth-sign-in',
  imports: [RouterLink, ButtonComponent, InputComponent],
  templateUrl: './sign-in.component.html',
  styleUrl: './sign-in.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignInComponent {
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly isSubmitting = signal(false);
  protected readonly globalError = signal('');

  private submitTimeoutId: number | null = null;
  private readonly destroyRef = inject(DestroyRef);

  protected readonly emailError = computed(() => {
    const value = this.email();
    if (!value) return '';
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    return isValid ? '' : 'Email format is invalid';
  });

  protected readonly passwordError = computed(() => {
    const value = this.password();
    if (!value) return '';
    return value.length >= 8 ? '' : 'Password must be at least 8 characters';
  });

  protected readonly canSubmit = computed(() =>
    !this.isSubmitting() && !!this.email() && !!this.password() && !this.emailError() && !this.passwordError()
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

    this.globalError.set('');
    this.isSubmitting.set(true);

    if (this.submitTimeoutId !== null) {
      globalThis.clearTimeout(this.submitTimeoutId);
    }

    this.submitTimeoutId = globalThis.setTimeout(() => {
      this.isSubmitting.set(false);
      this.globalError.set('Invalid credentials. Please try again.');
    }, 1200);
  }
}
