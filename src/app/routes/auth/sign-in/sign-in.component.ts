import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, finalize, map, of, switchMap } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { AuthService } from '../../../core/services/auth.service';
import { WebAuthnService } from '../../../core/services/webauthn.service';
import { ToastService } from '../../../core/services/toast.service';
import { MIN_LENGTH } from '../../../core/config';
import { OrganizationService } from '../../../core/services/organization.service';
import { UserService } from '../../../core/services/user.service';
import { getAuthErrorMessage } from '../../../core/utils/auth-error-mapper';
import { getEmailError, getPasswordMinLengthError } from '../../../core/utils/auth-form.utils';

@Component({
  selector: 'auth-sign-in',
  imports: [RouterLink, TranslatePipe, ButtonComponent, InputComponent],
  templateUrl: './sign-in.component.html',
  styleUrl: './sign-in.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignInComponent {
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly isSubmitting = signal(false);
  protected readonly isPasskeyLoading = signal(false);

  private readonly destroyRef = inject(DestroyRef);
  private readonly authService = inject(AuthService);
  private readonly webauthnService = inject(WebAuthnService);
  private readonly orgService = inject(OrganizationService);
  private readonly userService = inject(UserService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);

  protected readonly isPasskeySupported = this.webauthnService.isSupported;

  protected readonly emailError = computed(() => {
    const raw = getEmailError(this.email());
    return raw ? this.translate.instant('auth.form.emailError') : '';
  });

  protected readonly passwordError = computed(() => {
    const raw = getPasswordMinLengthError(this.password(), MIN_LENGTH.password);
    return raw ? this.translate.instant('auth.form.passwordError', { minLength: MIN_LENGTH.password }) : '';
  });

  protected readonly canSubmit = computed(() =>
    !this.isSubmitting() && !this.isPasskeyLoading() && !!this.email() && !!this.password() && !this.emailError() && !this.passwordError()
  );

  // removed empty constructor to satisfy lint rule

  protected onSubmit(event: Event): void {
    event.preventDefault();
    if (!this.canSubmit()) return;

    const email = this.email().trim().toLowerCase();
    const password = this.password();

    this.isSubmitting.set(true);

    this.authService.signIn({ email, password })
      .pipe(
        catchError(error => {
          this.toast.error(getAuthErrorMessage(error));
          return EMPTY;
        }),
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => this.postLoginRedirect());
  }

  protected onPasskeyLogin(): void {
    if (this.isPasskeyLoading() || this.isSubmitting()) return;
    this.isPasskeyLoading.set(true);

    this.webauthnService.beginLogin()
      .pipe(
        catchError(error => {
          // DOMException name "NotAllowedError" means user cancelled the prompt
          if (error instanceof DOMException && error.name === 'NotAllowedError') {
            return EMPTY;
          }
          this.toast.error(getAuthErrorMessage(error));
          return EMPTY;
        }),
        finalize(() => this.isPasskeyLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.postLoginRedirect());
  }

  private postLoginRedirect(): void {
    this.userService.getProfile()
      .pipe(
        catchError(() => of(null)),
        switchMap(profile => {
          if (!profile) {
            return of({ profile: null, org: null });
          }
          if (!profile.roles.includes('admin')) {
            return of({ profile, org: null });
          }
          return this.orgService.getOrganization().pipe(
            map(org => ({ profile, org })),
            catchError(() => of({ profile, org: null }))
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(({ profile, org }) => {
        const needsOnboarding = !profile?.firstName || !profile?.lastName || (profile?.roles.includes('admin') && !org?.name);
        void this.router.navigate([needsOnboarding ? '/onboarding' : '/app']);
      });
  }
}
