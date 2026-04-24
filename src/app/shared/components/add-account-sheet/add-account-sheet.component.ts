import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';
import { MIN_LENGTH } from '../../../core/config';
import { ToastService } from '../../../core/services/toast.service';
import { createEmailError, createPasswordError } from '../../../core/utils/auth-form.utils';
import { handleAuthSubmit } from '../../../core/utils/rx-operators';
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

  protected readonly emailError = createEmailError(this.email, this.translate);
  protected readonly passwordError = createPasswordError(this.password, MIN_LENGTH.password, this.translate);

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
      .pipe(handleAuthSubmit(this.destroyRef, this.isSubmitting, this.toast))
      .subscribe(() => {
        this.email.set('');
        this.password.set('');
        this.accountAdded.emit();
        this.closed.emit();
      });
  }
}
