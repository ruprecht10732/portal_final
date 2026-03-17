import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, finalize } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';
import { MIN_LENGTH } from '../../../core/config';
import { ToastService } from '../../../core/services/toast.service';
import { getAuthErrorMessage } from '../../../core/utils/auth-error-mapper';
import { getEmailError, getPasswordMinLengthError } from '../../../core/utils/auth-form.utils';
import { ButtonComponent } from '../button/button.component';
import { InputComponent } from '../input/input.component';
import { RightSidebarComponent } from '../right-sidebar/right-sidebar.component';

@Component({
  selector: 'app-add-account-sheet',
  imports: [TranslatePipe, ButtonComponent, InputComponent, RightSidebarComponent],
  templateUrl: './add-account-sheet.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddAccountSheetComponent {
  readonly isOpen = input(false);

  readonly closed = output<void>();
  readonly accountAdded = output<void>();

  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly isSubmitting = signal(false);

  private readonly destroyRef = inject(DestroyRef);
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);

  protected readonly emailError = computed(() => {
    const raw = getEmailError(this.email());
    return raw ? this.translate.instant('auth.form.emailError') : '';
  });

  protected readonly passwordError = computed(() => {
    const raw = getPasswordMinLengthError(this.password(), MIN_LENGTH.password);
    return raw ? this.translate.instant('auth.form.passwordError', { minLength: MIN_LENGTH.password }) : '';
  });

  protected readonly canSubmit = computed(() =>
    !this.isSubmitting() && !!this.email() && !!this.password() && !this.emailError() && !this.passwordError()
  );

  protected onClose(): void {
    this.password.set('');
    this.closed.emit();
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    if (!this.canSubmit()) {
      return;
    }

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
        this.email.set('');
        this.password.set('');
        this.accountAdded.emit();
        this.closed.emit();
      });
  }
}