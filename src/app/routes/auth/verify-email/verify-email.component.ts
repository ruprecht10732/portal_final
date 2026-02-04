import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { AuthService } from '../../../core/services/auth.service';
import { ErrorReportingService } from '../../../core/services/error-reporting.service';
import { handleSubmitState } from '../../../core/utils/rx-operators';
import { getErrorMessage } from '../../../core/utils/error-utils';

@Component({
  selector: 'auth-verify-email',
  imports: [RouterLink, ButtonComponent],
  templateUrl: './verify-email.component.html',
  styleUrl: './verify-email.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VerifyEmailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly authService = inject(AuthService);
  private readonly reporter = inject(ErrorReportingService);

  protected readonly isVerifying = signal(false);
  protected readonly isVerified = signal(false);
  protected readonly globalError = signal('');

  protected readonly token = toSignal(
    this.route.queryParamMap.pipe(map(params => params.get('token'))),
    { initialValue: null }
  );

  protected readonly isExpired = computed(() => this.token() === 'expired');
  protected readonly isMissing = computed(() => !this.token());

  constructor() {
    effect(() => {
      const tokenValue = this.token();
      if (!tokenValue || tokenValue === 'expired') {
        return;
      }

      this.isVerifying.set(true);
      this.globalError.set('');

      this.authService.verifyEmail({ token: tokenValue })
        .pipe(
          handleSubmitState({
            loading: this.isVerifying,
            error: this.globalError,
            reporter: this.reporter,
            getMessage: (error) => getErrorMessage(error),
          }),
          takeUntilDestroyed(this.destroyRef)
        )
        .subscribe(() => {
          this.isVerified.set(true);
        });
    });
  }
}
