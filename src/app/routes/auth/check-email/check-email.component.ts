import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { handleAuthSubmit } from '../../../core/utils/rx-operators';

@Component({
  selector: 'auth-check-email',
  imports: [RouterLink, TranslatePipe, ButtonComponent, InputComponent],
  templateUrl: './check-email.component.html',
  styleUrl: './check-email.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckEmailComponent {
  protected readonly cooldown = signal(0);
  protected readonly isResending = signal(false);
  protected readonly customEmail = signal('');

  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);
  private intervalId: number | null = null;

  protected readonly mode = toSignal(
    this.route.queryParamMap.pipe(map(params => params.get('mode'))),
    { initialValue: 'signup' }
  );

  protected readonly emailParam = toSignal(
    this.route.queryParamMap.pipe(map(params => params.get('email') ?? '')),
    { initialValue: '' }
  );

  protected readonly email = computed(() =>
    this.customEmail().trim() || this.emailParam()
  );

  protected readonly title = computed(() =>
    this.mode() === 'reset'
      ? this.translate.instant('auth.checkEmail.titleReset')
      : this.translate.instant('auth.checkEmail.titleSignup')
  );

  protected readonly message = computed(() =>
    this.mode() === 'reset'
      ? this.translate.instant('auth.checkEmail.messageReset')
      : this.translate.instant('auth.checkEmail.messageSignup')
  );

  protected readonly resendLabel = computed(() => {
    if (this.isResending()) return this.translate.instant('common.loading');
    if (this.cooldown() === 0) return this.translate.instant('auth.checkEmail.resend');
    const seconds = this.cooldown().toString().padStart(2, '0');
    return this.translate.instant('auth.checkEmail.resendCooldown', { seconds });
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.clearInterval());
  }

  protected resend(): void {
    if (this.cooldown() > 0 || this.isResending()) return;
    const targetEmail = this.email().trim().toLowerCase();
    if (!targetEmail) {
      this.toast.error(this.translate.instant('auth.checkEmail.emailRequired') || 'Please enter your email address');
      return;
    }

    this.isResending.set(true);

    const resend$ = this.mode() === 'reset'
      ? this.authService.forgotPassword({ email: targetEmail })
      : this.authService.resendVerification(targetEmail);

    resend$
      .pipe(handleAuthSubmit(this.destroyRef, this.isResending, this.toast))
      .subscribe(() => {
        this.toast.success(this.translate.instant('auth.checkEmail.resendSuccess') || 'Email resent successfully! Please check your inbox.');
        this.startCooldown();
      });
  }

  private startCooldown(): void {
    this.cooldown.set(30);
    this.clearInterval();
    this.intervalId = globalThis.setInterval(() => {
      this.cooldown.update(value => Math.max(0, value - 1));
      if (this.cooldown() === 0) {
        this.clearInterval();
      }
    }, 1000);
  }

  private clearInterval(): void {
    if (this.intervalId !== null) {
      globalThis.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

