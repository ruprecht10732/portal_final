import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, finalize } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { MIN_LENGTH } from '../../../core/config';
import { getAuthErrorMessage } from '../../../core/utils/auth-error-mapper';
import {
  getEmailError,
  getPasswordChecks,
  getPasswordMinLengthError,
  type PasswordRule,
} from '../../../core/utils/auth-form.utils';

@Component({
  selector: 'auth-sign-up',
  imports: [RouterLink, TranslatePipe, ButtonComponent, InputComponent],
  templateUrl: './sign-up.component.html',
  styleUrl: './sign-up.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignUpComponent implements OnInit {
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly isSubmitting = signal(false);
  protected readonly inviteToken = signal<string | null>(null);
  protected readonly organizationName = signal<string | null>(null);
  protected readonly isLoadingInvite = signal(false);
  protected readonly emailReadonly = signal(false);

  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);

  protected readonly emailError = computed(() => {
    const raw = getEmailError(this.email());
    return raw ? this.translate.instant('auth.form.emailError') : '';
  });

  protected readonly passwordChecks = computed(() => getPasswordChecks(this.password(), MIN_LENGTH.password));

  protected readonly passwordRules = computed<PasswordRule[]>(() => {
    const checks = this.passwordChecks();
    const minLength = MIN_LENGTH.password;
    return [
      { label: this.translate.instant('auth.passwordRules.minLength', { minLength }), met: checks.hasMinLength },
      { label: this.translate.instant('auth.passwordRules.hasNumber'), met: checks.hasNumber },
      { label: this.translate.instant('auth.passwordRules.hasUppercase'), met: checks.hasUppercase },
      { label: this.translate.instant('auth.passwordRules.hasSpecial'), met: checks.hasSpecial },
    ];
  });

  protected readonly passwordError = computed(() => {
    const raw = getPasswordMinLengthError(this.password(), MIN_LENGTH.password);
    return raw ? this.translate.instant('auth.form.passwordError', { minLength: MIN_LENGTH.password }) : '';
  });

  protected readonly canSubmit = computed(() =>
    !this.isSubmitting() &&
    !this.isLoadingInvite() &&
    !!this.email() &&
    !!this.password() &&
    !this.emailError() &&
    this.passwordChecks().hasMinLength
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
          this.toast.error(getAuthErrorMessage(error));
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
        catchError(error => {
          this.toast.error(getAuthErrorMessage(error));
          return EMPTY;
        }),
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        void this.router.navigate(['/check-email'], { queryParams: { mode: 'signup' } });
      });
  }
}
