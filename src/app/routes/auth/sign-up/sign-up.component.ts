import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { MIN_LENGTH } from '../../../core/config';
import { handleAuthSubmit } from '../../../core/utils/rx-operators';
import {
  createEmailError,
  createPasswordChecks,
  createPasswordError,
  createPasswordRules,
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

  protected readonly emailError = createEmailError(this.email, this.translate);
  protected readonly passwordChecks = createPasswordChecks(this.password, MIN_LENGTH.password);
  protected readonly passwordRules = createPasswordRules(this.passwordChecks, MIN_LENGTH.password, this.translate);
  protected readonly passwordError = createPasswordError(this.password, MIN_LENGTH.password, this.translate);

  protected readonly canSubmit = computed(() =>
    !this.isSubmitting() &&
    !this.isLoadingInvite() &&
    !!this.email() &&
    !!this.password() &&
    !this.emailError() &&
    this.passwordChecks().hasMinLength
  );

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
      .pipe(handleAuthSubmit(this.destroyRef, this.isLoadingInvite, this.toast))
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
      email: this.email().trim(),
      password: this.password(),
    };

    const token = this.inviteToken();
    if (token) {
      payload.inviteToken = token;
    }

    this.authService.signUp(payload)
      .pipe(handleAuthSubmit(this.destroyRef, this.isSubmitting, this.toast))
      .subscribe(() => {
        void this.router.navigate(['/check-email'], { queryParams: { mode: 'signup', email: payload.email } });
      });
  }
}
