import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, finalize, map, of, switchMap } from 'rxjs';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { MIN_LENGTH } from '../../../core/config';
import { OrganizationService } from '../../../core/services/organization.service';
import { UserService } from '../../../core/services/user.service';
import { getAuthErrorMessage } from '../../../core/utils/auth-error-mapper';
import { getEmailError, getPasswordMinLengthError } from '../../../core/utils/auth-form.utils';

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

  private readonly destroyRef = inject(DestroyRef);
  private readonly authService = inject(AuthService);
  private readonly orgService = inject(OrganizationService);
  private readonly userService = inject(UserService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly emailError = computed(() => getEmailError(this.email()));

  protected readonly passwordError = computed(() => getPasswordMinLengthError(this.password(), MIN_LENGTH.password));

  protected readonly canSubmit = computed(() =>
    !this.isSubmitting() && !!this.email() && !!this.password() && !this.emailError() && !this.passwordError()
  );

  // removed empty constructor to satisfy lint rule

  protected onSubmit(event: Event): void {
    event.preventDefault();
    if (!this.canSubmit()) return;

    this.isSubmitting.set(true);

    this.authService.signIn({ email: this.email(), password: this.password() })
      .pipe(
        catchError(error => {
          this.toast.error(getAuthErrorMessage(error));
          return EMPTY;
        }),
        finalize(() => this.isSubmitting.set(false)),
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
            void this.router.navigate([needsOnboarding ? '/onboarding' : '/app']);
          });
      });
  }
}
