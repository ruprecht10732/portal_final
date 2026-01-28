import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { InputComponent } from '../../../shared/components/input/input.component';

@Component({
  selector: 'auth-forgot-password',
  imports: [RouterLink, ButtonComponent, InputComponent],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForgotPasswordComponent {
  protected readonly email = signal('');
  protected readonly isSubmitting = signal(false);

  private submitTimeoutId: number | null = null;
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  protected readonly emailError = computed(() => {
    const value = this.email();
    if (!value) return '';
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    return isValid ? '' : 'Email format is invalid';
  });

  protected readonly canSubmit = computed(() =>
    !this.isSubmitting() && !!this.email() && !this.emailError()
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
      this.router.navigate(['/check-email'], { queryParams: { mode: 'reset' } });
    }, 1200);
  }
}
