import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize, EMPTY } from 'rxjs';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { AuthService } from '../../../core/services/auth.service';
import { ErrorReportingService } from '../../../core/services/error-reporting.service';
import { MIN_LENGTH } from '../../../core/config';
import { handleSubmitState } from '../../../core/utils/rx-operators';

interface PasswordRule {
  label: string;
  met: boolean;
}

@Component({
  selector: 'auth-sign-up',
  imports: [RouterLink, ButtonComponent, InputComponent],
  templateUrl: './sign-up.component.html',
  styleUrl: './sign-up.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignUpComponent implements OnInit {
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly isSubmitting = signal(false);
  protected readonly globalError = signal('');
  protected readonly inviteToken = signal<string | null>(null);
  protected readonly organizationName = signal<string | null>(null);
  protected readonly isLoadingInvite = signal(false);
  protected readonly emailReadonly = signal(false);

  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);
  private readonly reporter = inject(ErrorReportingService);

  protected readonly emailError = computed(() => {
    const value = this.email();
    if (!value) return '';
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    return isValid ? '' : 'Email format is invalid';
  });

  protected readonly hasMinLength = computed(() => this.password().length >= MIN_LENGTH.password);
  protected readonly hasNumber = computed(() => /\d/.test(this.password()));
  protected readonly hasUppercase = computed(() => /[A-Z]/.test(this.password()));
  protected readonly hasSpecial = computed(() => /[^A-Za-z0-9]/.test(this.password()));

  protected readonly passwordRules = computed<PasswordRule[]>(() => [
    { label: `At least ${MIN_LENGTH.password} characters`, met: this.hasMinLength() },
    { label: 'Contains a number', met: this.hasNumber() },
    { label: 'Contains an uppercase letter', met: this.hasUppercase() },
    { label: 'Contains a special character', met: this.hasSpecial() },
  ]);

  protected readonly passwordError = computed(() => {
    const value = this.password();
    if (!value) return '';
    return this.hasMinLength() ? '' : `Password must be at least ${MIN_LENGTH.password} characters`;
  });

  protected readonly canSubmit = computed(() =>
    !this.isSubmitting() && !this.isLoadingInvite() && !!this.email() && !!this.password() && !this.emailError() && this.hasMinLength()
  );

  constructor() {
    effect(() => {
      const value = this.email();
      const trimmed = value.trim();
      if (trimmed !== value) {
        this.email.set(trimmed);
      }
    });
  }

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (token) {
      this.inviteToken.set(token);
      this.resolveInvite(token);
    }
  }

  private resolveInvite(token: string): void {
    this.isLoadingInvite.set(true);
    this.authService.resolveInvite(token)
      .pipe(
        catchError(error => {
          const message = this.authService.getErrorMessage(error);
          this.globalError.set(message);
          this.inviteToken.set(null);
          return EMPTY;
        }),
        finalize(() => this.isLoadingInvite.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(response => {
        this.email.set(response.email);
        this.emailReadonly.set(true);
        this.organizationName.set(response.organizationName);
      });
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    if (!this.canSubmit()) return;

    this.globalError.set('');
    this.isSubmitting.set(true);

    const payload: { email: string; password: string; inviteToken?: string } = {
      email: this.email(),
      password: this.password(),
    };

    const token = this.inviteToken();
    if (token) {
      payload.inviteToken = token;
    }

    this.authService.signUp(payload)
      .pipe(
        handleSubmitState({
          loading: this.isSubmitting,
          error: this.globalError,
          reporter: this.reporter,
          getMessage: (error) => this.authService.getErrorMessage(error),
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        void this.router.navigate(['/check-email'], { queryParams: { mode: 'signup' } });
      });
  }
}
