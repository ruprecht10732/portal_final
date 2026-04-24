import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { catchError, map, of, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { AuthService } from '../../../core/services/auth.service';
import { WebAuthnService } from '../../../core/services/webauthn.service';
import { ToastService } from '../../../core/services/toast.service';
import { MIN_LENGTH } from '../../../core/config';
import { OrganizationService } from '../../../core/services/organization.service';
import { UserService } from '../../../core/services/user.service';
import { createEmailError, createPasswordError } from '../../../core/utils/auth-form.utils';
import { handleAuthSubmit } from '../../../core/utils/rx-operators';

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

  protected readonly emailError = createEmailError(this.email, this.translate);
  protected readonly passwordError = createPasswordError(this.password, MIN_LENGTH.password, this.translate);

  protected readonly canSubmit = computed(() =>
    !this.isSubmitting() && !this.isPasskeyLoading() && !!this.email() && !!this.password() && !this.emailError() && !this.passwordError()
  );

  protected onSubmit(event: Event): void {
    event.preventDefault();
    if (!this.canSubmit()) return;

    const email = this.email().trim().toLowerCase();
    const password = this.password();

    this.isSubmitting.set(true);

    this.authService.signIn({ email, password })
      .pipe(handleAuthSubmit(this.destroyRef, this.isSubmitting, this.toast))
      .subscribe(() => this.postLoginRedirect());
  }

  protected onPasskeyLogin(): void {
    if (this.isPasskeyLoading() || this.isSubmitting()) return;
    this.isPasskeyLoading.set(true);

    this.webauthnService.beginLogin()
      .pipe(
        handleAuthSubmit(this.destroyRef, this.isPasskeyLoading, this.toast, {
          ignore: (error) => error instanceof DOMException && (error as DOMException).name === 'NotAllowedError',
        }),
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
