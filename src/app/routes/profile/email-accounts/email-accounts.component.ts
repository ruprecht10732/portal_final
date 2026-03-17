import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, distinctUntilChanged, EMPTY, filter, finalize, switchMap } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { UserService } from '../../../core/services/user.service';
import { ToastService } from '../../../core/services/toast.service';
import type { CreateIMAPAccountRequest, IMAPAccount, UpdateIMAPAccountRequest } from '../../../core/services/user.types';

@Component({
  selector: 'app-email-accounts',
  imports: [TranslateModule, ButtonComponent, InputComponent],
  templateUrl: './email-accounts.component.html',
  styleUrl: './email-accounts.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'xl:flex xl:flex-col xl:flex-1 xl:min-h-0 xl:overflow-y-auto' },
})
export class EmailAccountsComponent {
  private readonly userService = inject(UserService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);

  protected readonly accounts = signal<IMAPAccount[]>([]);
  protected readonly loadingAccounts = signal(false);
  protected readonly saving = signal(false);
  protected readonly testingAccountId = signal<string | null>(null);
  protected readonly syncingAccountId = signal<string | null>(null);
  protected readonly editingAccountId = signal<string | null>(null);
  protected readonly updatingAccountId = signal<string | null>(null);

  protected readonly formEmailAddress = signal('');
  protected readonly formHost = signal('');
  protected readonly formPort = signal<number>(993);
  protected readonly formUsername = signal('');
  protected readonly formPassword = signal('');
  protected readonly formSmtpHost = signal('');
  protected readonly formSmtpPort = signal<number>(587);
  protected readonly formSmtpUsername = signal('');
  protected readonly formSmtpPassword = signal('');
  protected readonly formSmtpFromEmail = signal('');
  protected readonly formSmtpFromName = signal('');
  protected readonly formFolder = signal('INBOX');
  protected readonly formEnabled = signal(true);
  protected readonly detectingSettings = signal(false);
  protected readonly detectionFailed = signal(false);
  protected readonly detectedProvider = signal('');
  protected readonly detectedHost = signal('');
  protected readonly detectedPort = signal<number | null>(null);
  protected readonly editEmailAddress = signal('');
  protected readonly editHost = signal('');
  protected readonly editPort = signal<number>(993);
  protected readonly editUsername = signal('');
  protected readonly editPassword = signal('');
  protected readonly editSmtpHost = signal('');
  protected readonly editSmtpPort = signal<number>(587);
  protected readonly editSmtpUsername = signal('');
  protected readonly editSmtpPassword = signal('');
  protected readonly editSmtpFromEmail = signal('');
  protected readonly editSmtpFromName = signal('');
  protected readonly editFolder = signal('INBOX');

  protected readonly canCreate = computed(() => {
    return (
      !this.saving() &&
      !!this.formEmailAddress() &&
      !!this.formHost() &&
      this.formPort() > 0 &&
      !!this.formUsername() &&
      !!this.formPassword()
    );
  });

  constructor() {
    this.loadAccounts();
    this.setupAutoDetect();
  }

  protected loadAccounts(): void {
    this.loadingAccounts.set(true);
    this.userService
      .listIMAPAccounts()
      .pipe(
        catchError(error => {
          this.toast.error(this.normalizeError(error, 'profile.imap.errors.loadAccounts'));
          return EMPTY;
        }),
        finalize(() => this.loadingAccounts.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(accounts => {
        this.accounts.set(accounts);
      });
  }

  protected createAccount(): void {
    if (!this.canCreate()) return;
    this.saving.set(true);
    const payload: CreateIMAPAccountRequest = {
      emailAddress: this.formEmailAddress().trim(),
      imapHost: this.formHost().trim(),
      imapPort: this.formPort(),
      imapUsername: this.formUsername().trim(),
      imapPassword: this.formPassword(),
      smtpPort: this.formSmtpPort(),
      folderName: this.formFolder().trim() || 'INBOX',
      enabled: this.formEnabled(),
    };
    const smtpHost = this.formSmtpHost().trim();
    const smtpUsername = this.formSmtpUsername().trim();
    const smtpFromEmail = this.formSmtpFromEmail().trim();
    const smtpFromName = this.formSmtpFromName().trim();
    const smtpPassword = this.formSmtpPassword().trim();
    if (smtpHost) payload.smtpHost = smtpHost;
    if (smtpUsername) payload.smtpUsername = smtpUsername;
    if (smtpPassword) payload.smtpPassword = smtpPassword;
    if (smtpFromEmail) payload.smtpFromEmail = smtpFromEmail;
    if (smtpFromName) payload.smtpFromName = smtpFromName;
    this.userService
      .createIMAPAccount(payload)
      .pipe(
        catchError(error => {
          this.toast.error(this.normalizeError(error, 'profile.imap.errors.saveAccount'));
          return EMPTY;
        }),
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(account => {
        this.toast.success(this.translate.instant('profile.imap.messages.accountSaved'));
        this.accounts.set([account, ...this.accounts()]);
        this.resetForm();
      });
  }

  protected deleteAccount(accountId: string): void {
    this.userService
      .deleteIMAPAccount(accountId)
      .pipe(
        catchError(error => {
          this.toast.error(this.normalizeError(error, 'profile.imap.errors.deleteAccount'));
          return EMPTY;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.toast.success(this.translate.instant('profile.imap.messages.accountDeleted'));
        this.accounts.set(this.accounts().filter(item => item.id !== accountId));
      });
  }

  protected testAccount(accountId: string): void {
    this.testingAccountId.set(accountId);
    this.userService
      .testIMAPAccount(accountId)
      .pipe(
        catchError(error => {
          this.toast.error(this.normalizeError(error, 'profile.imap.errors.testAccount'));
          return EMPTY;
        }),
        finalize(() => this.testingAccountId.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.toast.success(this.translate.instant('profile.imap.messages.testSuccess'));
      });
  }

  protected syncAccount(accountId: string): void {
    this.syncingAccountId.set(accountId);
    this.userService
      .syncIMAPAccount(accountId)
      .pipe(
        catchError(error => {
          this.toast.error(this.normalizeError(error, 'profile.imap.errors.syncAccount'));
          return EMPTY;
        }),
        finalize(() => this.syncingAccountId.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.toast.success(this.translate.instant('profile.imap.messages.syncQueued'));
        this.loadAccounts();
      });
  }

  protected isTesting(accountId: string): boolean {
    return this.testingAccountId() === accountId;
  }

  protected isSyncing(accountId: string): boolean {
    return this.syncingAccountId() === accountId;
  }

  protected startEditAccount(account: IMAPAccount): void {
    this.editingAccountId.set(account.id);
    this.editEmailAddress.set(account.emailAddress ?? '');
    this.editHost.set(account.imapHost ?? '');
    this.editPort.set(account.imapPort ?? 993);
    this.editUsername.set(account.imapUsername ?? '');
    this.editPassword.set('');
    this.editSmtpHost.set(account.smtpHost ?? account.imapHost ?? '');
    this.editSmtpPort.set(account.smtpPort ?? 587);
    this.editSmtpUsername.set(account.smtpUsername ?? account.imapUsername ?? account.emailAddress ?? '');
    this.editSmtpPassword.set('');
    this.editSmtpFromEmail.set(account.smtpFromEmail ?? account.emailAddress ?? '');
    this.editSmtpFromName.set(account.smtpFromName ?? '');
    this.editFolder.set(account.folderName ?? 'INBOX');
  }

  protected cancelEditAccount(): void {
    this.editingAccountId.set(null);
    this.updatingAccountId.set(null);
  }

  protected isEditing(accountId: string): boolean {
    return this.editingAccountId() === accountId;
  }

  protected isUpdating(accountId: string): boolean {
    return this.updatingAccountId() === accountId;
  }

  protected saveEditAccount(account: IMAPAccount): void {
    if (!this.editEmailAddress().trim() || !this.editHost().trim() || !this.editUsername().trim() || this.editPort() <= 0 || this.editSmtpPort() <= 0) {
      this.toast.error(this.translate.instant('profile.imap.errors.invalidEditForm'));
      return;
    }
    this.updatingAccountId.set(account.id);
    const payload: UpdateIMAPAccountRequest = {
      emailAddress: this.editEmailAddress().trim(),
      imapHost: this.editHost().trim(),
      imapPort: this.editPort(),
      imapUsername: this.editUsername().trim(),
      smtpPort: this.editSmtpPort(),
      folderName: this.editFolder().trim() || 'INBOX',
      enabled: account.enabled,
    };
    const editPassword = this.editPassword().trim();
    const editSmtpHost = this.editSmtpHost().trim();
    const editSmtpUsername = this.editSmtpUsername().trim();
    const editSmtpPassword = this.editSmtpPassword().trim();
    const editSmtpFromEmail = this.editSmtpFromEmail().trim();
    const editSmtpFromName = this.editSmtpFromName().trim();
    if (editPassword) payload.imapPassword = editPassword;
    if (editSmtpHost) payload.smtpHost = editSmtpHost;
    if (editSmtpUsername) payload.smtpUsername = editSmtpUsername;
    if (editSmtpPassword) payload.smtpPassword = editSmtpPassword;
    if (editSmtpFromEmail) payload.smtpFromEmail = editSmtpFromEmail;
    if (editSmtpFromName) payload.smtpFromName = editSmtpFromName;

    this.userService
      .updateIMAPAccount(account.id, payload)
      .pipe(
        catchError(error => {
          this.toast.error(this.normalizeError(error, 'profile.imap.errors.updateAccount'));
          return EMPTY;
        }),
        finalize(() => this.updatingAccountId.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(updatedAccount => {
        this.accounts.update(items => items.map(item => (item.id === updatedAccount.id ? updatedAccount : item)));
        this.toast.success(this.translate.instant('profile.imap.messages.accountUpdated'));
        this.cancelEditAccount();
      });
  }

  private setupAutoDetect(): void {
    toObservable(this.formEmailAddress)
      .pipe(
        debounceTime(600),
        distinctUntilChanged(),
        filter(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())),
        switchMap(email => {
          this.detectingSettings.set(true);
          this.detectionFailed.set(false);
          this.detectedProvider.set('');
          this.detectedHost.set('');
          this.detectedPort.set(null);

          if (!this.formUsername().trim()) {
            this.formUsername.set(email.trim());
          }
          if (!this.formSmtpUsername().trim()) {
            this.formSmtpUsername.set(email.trim());
          }
          if (!this.formSmtpFromEmail().trim()) {
            this.formSmtpFromEmail.set(email.trim());
          }

          return this.userService.detectIMAPAccount(email.trim()).pipe(
            catchError(() => {
              this.detectionFailed.set(true);
              return EMPTY;
            }),
            finalize(() => this.detectingSettings.set(false)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(result => {
        if (!result.detected || !result.host) {
          this.detectionFailed.set(true);
          return;
        }
        this.detectionFailed.set(false);
        if (result.provider) this.detectedProvider.set(result.provider);
        if (result.host) {
          this.formHost.set(result.host);
          this.detectedHost.set(result.host);
          if (!this.formSmtpHost().trim()) {
            this.formSmtpHost.set(result.host);
          }
        }
        if (result.port) {
          this.formPort.set(result.port);
          this.detectedPort.set(result.port);
        }
        if (result.username) this.formUsername.set(result.username);
      });
  }

  private resetForm(): void {
    this.formEmailAddress.set('');
    this.formHost.set('');
    this.formPort.set(993);
    this.formUsername.set('');
    this.formPassword.set('');
    this.formSmtpHost.set('');
    this.formSmtpPort.set(587);
    this.formSmtpUsername.set('');
    this.formSmtpPassword.set('');
    this.formSmtpFromEmail.set('');
    this.formSmtpFromName.set('');
    this.formFolder.set('INBOX');
    this.formEnabled.set(true);
    this.detectingSettings.set(false);
    this.detectionFailed.set(false);
    this.detectedProvider.set('');
    this.detectedHost.set('');
    this.detectedPort.set(null);
  }

  private normalizeError(error: unknown, fallbackKey: string): string {
    if (error && typeof error === 'object' && 'error' in error) {
      const apiError = (error as { error?: { error?: string } }).error;
      if (apiError && typeof apiError === 'object' && typeof apiError.error === 'string' && apiError.error.trim()) {
        return apiError.error;
      }
    }
    return this.translate.instant(fallbackKey);
  }
}
