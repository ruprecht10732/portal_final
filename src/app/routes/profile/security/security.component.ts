import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, finalize } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DatePipe } from '@angular/common';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { UserService } from '../../../core/services/user.service';
import { WebAuthnService, PasskeyInfo } from '../../../core/services/webauthn.service';
import { ToastService } from '../../../core/services/toast.service';
import { MIN_LENGTH } from '../../../core/config';

@Component({
  selector: 'app-security',
  imports: [ButtonComponent, InputComponent, TranslateModule, DatePipe],
  templateUrl: './security.component.html',
  styleUrl: './security.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'xl:flex xl:flex-col xl:flex-1 xl:min-h-0 xl:overflow-y-auto' },
})
export class SecurityComponent implements OnInit {
  protected readonly currentPassword = signal('');
  protected readonly newPassword = signal('');
  protected readonly confirmPassword = signal('');

  protected readonly isSaving = signal(false);
  protected readonly successMessage = signal('');
  protected readonly errorMessage = signal('');

  // Passkey state
  protected readonly passkeys = signal<PasskeyInfo[]>([]);
  protected readonly isLoadingPasskeys = signal(false);
  protected readonly isAddingPasskey = signal(false);
  protected readonly passkeyNickname = signal('');
  protected readonly showAddPasskey = signal(false);
  protected readonly renamingPasskeyId = signal<string | null>(null);
  protected readonly renameNickname = signal('');

  private readonly userService = inject(UserService);
  private readonly webauthnService = inject(WebAuthnService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);
  private readonly lang = toSignal(this.translate.onLangChange, {
    initialValue: { lang: 'en', translations: {} },
  });

  protected readonly isWebAuthnSupported = this.webauthnService.isSupported;

  protected readonly newPasswordError = computed(() => {
    this.lang();
    const value = this.newPassword();
    if (!value) return '';
    return value.length >= MIN_LENGTH.password
      ? ''
      : this.translate.instant('profile.securityPage.errors.minPassword', { count: MIN_LENGTH.password });
  });

  protected readonly confirmPasswordError = computed(() => {
    this.lang();
    if (!this.confirmPassword()) return '';
    return this.newPassword() === this.confirmPassword()
      ? ''
      : this.translate.instant('profile.securityPage.errors.passwordsNoMatch');
  });

  protected readonly canSave = computed(() =>
    !this.isSaving() &&
    !!this.currentPassword() &&
    !!this.newPassword() &&
    !this.newPasswordError() &&
    !!this.confirmPassword() &&
    !this.confirmPasswordError()
  );

  ngOnInit(): void {
    if (this.isWebAuthnSupported) {
      this.loadPasskeys();
    }
  }

  protected save(): void {
    if (!this.canSave()) return;
    this.successMessage.set('');
    this.errorMessage.set('');
    this.isSaving.set(true);

    this.userService
      .changePassword({
        currentPassword: this.currentPassword(),
        newPassword: this.newPassword(),
      })
      .pipe(
        catchError(error => {
          this.errorMessage.set(this.normalizeError(error));
          return EMPTY;
        }),
        finalize(() => this.isSaving.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.currentPassword.set('');
        this.newPassword.set('');
        this.confirmPassword.set('');
        this.successMessage.set(this.translate.instant('profile.securityPage.success'));
      });
  }

  // ---------------------------------------------------------------------------
  // Passkey management
  // ---------------------------------------------------------------------------

  protected loadPasskeys(): void {
    this.isLoadingPasskeys.set(true);
    this.webauthnService
      .listPasskeys()
      .pipe(
        catchError(() => {
          this.toast.error(this.translate.instant('profile.securityPage.passkeys.genericError'));
          return EMPTY;
        }),
        finalize(() => this.isLoadingPasskeys.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(passkeys => this.passkeys.set(passkeys));
  }

  protected toggleAddPasskey(): void {
    this.showAddPasskey.update(v => !v);
    if (!this.showAddPasskey()) {
      this.passkeyNickname.set('');
    }
  }

  protected addPasskey(): void {
    const nickname = this.passkeyNickname().trim();
    if (!nickname || this.isAddingPasskey()) return;
    this.isAddingPasskey.set(true);

    this.webauthnService
      .beginRegistration(nickname)
      .pipe(
        catchError(() => {
          this.toast.error(this.translate.instant('profile.securityPage.passkeys.addError'));
          return EMPTY;
        }),
        finalize(() => this.isAddingPasskey.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.toast.success(this.translate.instant('profile.securityPage.passkeys.addSuccess'));
        this.showAddPasskey.set(false);
        this.passkeyNickname.set('');
        this.loadPasskeys();
      });
  }

  protected startRename(passkey: PasskeyInfo): void {
    this.renamingPasskeyId.set(passkey.id);
    this.renameNickname.set(passkey.nickname);
  }

  protected cancelRename(): void {
    this.renamingPasskeyId.set(null);
    this.renameNickname.set('');
  }

  protected confirmRename(passkey: PasskeyInfo): void {
    const nickname = this.renameNickname().trim();
    if (!nickname) return;

    this.webauthnService
      .renamePasskey(passkey.id, nickname)
      .pipe(
        catchError(() => {
          this.toast.error(this.translate.instant('profile.securityPage.passkeys.genericError'));
          return EMPTY;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.toast.success(this.translate.instant('profile.securityPage.passkeys.renameSuccess'));
        this.renamingPasskeyId.set(null);
        this.renameNickname.set('');
        this.loadPasskeys();
      });
  }

  protected deletePasskey(passkey: PasskeyInfo): void {
    if (!confirm(this.translate.instant('profile.securityPage.passkeys.confirmDelete'))) return;

    this.webauthnService
      .deletePasskey(passkey.id)
      .pipe(
        catchError(() => {
          this.toast.error(this.translate.instant('profile.securityPage.passkeys.genericError'));
          return EMPTY;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.toast.success(this.translate.instant('profile.securityPage.passkeys.deleteSuccess'));
        this.loadPasskeys();
      });
  }

  private normalizeError(error: unknown): string {
    if (typeof error === 'string') return error;
    if (error && typeof error === 'object' && 'error' in error) {
      const value = (error as { error?: string }).error;
      if (value) return value;
    }
    if (error && typeof error === 'object' && 'message' in error) {
      const value = (error as { message?: string }).message;
      if (value) return value;
    }
    return this.translate.instant('profile.securityPage.errors.generic');
  }
}
