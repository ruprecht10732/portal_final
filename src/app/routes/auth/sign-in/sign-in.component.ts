import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, map, of, switchMap } from 'rxjs';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { AuthService } from '../../../core/services/auth.service';
import { ErrorReportingService } from '../../../core/services/error-reporting.service';
import { MIN_LENGTH } from '../../../core/config';
import { OrganizationService } from '../../../core/services/organization.service';
import { UserService } from '../../../core/services/user.service';
import { handleSubmitState } from '../../../core/utils/rx-operators';
import { getErrorMessage } from '../../../core/utils/error-utils';

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

  private readonly destroyRef = inject(DestroyRef);
  private readonly authService = inject(AuthService);
  private readonly orgService = inject(OrganizationService);
  private readonly userService = inject(UserService);
  private readonly router = inject(Router);
  private readonly reporter = inject(ErrorReportingService);

  protected readonly emailError = computed(() => {
    const value = this.email();
    if (!value) return '';
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    return isValid ? '' : 'Email format is invalid';
  });

  protected readonly passwordError = computed(() => {
    const value = this.password();
    if (!value) return '';
    return value.length >= MIN_LENGTH.password ? '' : `Password must be at least ${MIN_LENGTH.password} characters`;
  });

  protected readonly canSubmit = computed(() =>
    !this.isSubmitting() && !!this.email() && !!this.password() && !this.emailError() && !this.passwordError()
  );

  // removed empty constructor to satisfy lint rule

  protected onSubmit(event: Event): void {
    event.preventDefault();
    if (!this.canSubmit()) return;

    this.globalError.set('');
    this.isSubmitting.set(true);

    this.authService.signIn({ email: this.email(), password: this.password() })
      .pipe(
        handleSubmitState({
          loading: this.isSubmitting,
          error: this.globalError,
          reporter: this.reporter,
          getMessage: (error) => getErrorMessage(error),
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
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
            void this.router.navigate([needsOnboarding ? '/app/onboarding' : '/app']);
          });
      });
  }
}
