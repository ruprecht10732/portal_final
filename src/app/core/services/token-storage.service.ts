import { inject, Injectable } from '@angular/core';
import { AccountRegistryService } from './account-registry.service';
import { decodeJwtClaims } from '../utils/jwt-token.utils';

/**
 * @deprecated Do not use for new features. Inject AccountRegistryService directly instead.
 * This service is a legacy wrapper and is slated for removal.
 */
@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  private readonly accounts = inject(AccountRegistryService);

  // Kept as a getter strictly for backward compatibility with legacy components.
  // It now safely reads from the reactive signal.
  get accessTokenValue(): string | null {
    return this.accounts.usableActiveAccount()?.token ?? null;
  }

  setAccessToken(accessToken: string): void {
    const claims = decodeJwtClaims(accessToken);
    const uid = claims?.sub?.trim();
    if (!uid) return;

    const existingAccount = this.accounts.getAccount(uid);
    const email = claims?.email?.trim() || existingAccount?.email || '';

    if (existingAccount) {
      // Safely update the existing account without losing its specific refresh token
      this.accounts.updateTokens(uid, accessToken, existingAccount.refreshToken, email);
    } else {
      // Add as a new account (we don't have a refresh token for it yet)
      this.accounts.addAccount(uid, email, accessToken, '');
    }
  }

  clear(): void {
    const activeAccount = this.accounts.activeAccount();
    if (activeAccount) {
      this.accounts.removeAccount(activeAccount.uid);
    } else {
      this.accounts.logoutAll();
    }
  }
}