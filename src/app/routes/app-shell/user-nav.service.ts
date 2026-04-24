import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { AccountRegistryService } from '../../core/services/account-registry.service';
import { AuthService } from '../../core/services/auth.service';
import { isJwtExpired } from '../../core/utils/jwt-token.utils';

@Injectable({ providedIn: 'root' })
export class UserNavService {
  private readonly router = inject(Router);
  private readonly accountRegistry = inject(AccountRegistryService);
  private readonly authService = inject(AuthService);

  switchAccount(uid: string): void {
    const targetAccount = this.accountRegistry.getAccount(uid);
    if (!targetAccount || targetAccount.isExpired) return;

    if (isJwtExpired(targetAccount.token)) {
      if (!targetAccount.refreshToken) {
        this.accountRegistry.markExpired(targetAccount.uid);
        return;
      }
      this.authService.refresh(targetAccount.refreshToken, targetAccount.uid).subscribe({
        next: () => {
          if (this.accountRegistry.switchAccount(uid)) {
            globalThis.location.assign('/app/dashboard');
          }
        },
        error: () => this.accountRegistry.markExpired(targetAccount.uid),
      });
      return;
    }

    if (this.accountRegistry.switchAccount(uid)) {
      globalThis.location.assign('/app/dashboard');
    }
  }

  signOutCurrentAccount(): void {
    const activeAccount = this.accountRegistry.activeAccount();
    if (!activeAccount) {
      void this.router.navigate(['/sign-in']);
      return;
    }
    this.authService.signOut(activeAccount.refreshToken).subscribe({
      next: () => this.finishSignOut(activeAccount.uid),
      error: () => this.finishSignOut(activeAccount.uid),
    });
  }

  private finishSignOut(uid: string): void {
    const removal = this.accountRegistry.removeAccount(uid);
    if (removal.nextActive && !removal.nextActive.isExpired) {
      globalThis.location.assign('/app/dashboard');
      return;
    }
    void this.router.navigate(['/sign-in']);
  }

  signOutAllAccounts(): void {
    if (this.accountRegistry.accounts().length > 0) {
      this.authService.signOutAllAccounts().subscribe({
        next: () => this.completeSignOutAll(),
        error: () => this.completeSignOutAll(),
      });
      return;
    }
    this.completeSignOutAll();
  }

  private completeSignOutAll(): void {
    this.accountRegistry.logoutAll();
    void this.router.navigate(['/sign-in']);
  }
}
