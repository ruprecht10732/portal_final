import { inject, Injectable } from '@angular/core';
import { AccountRegistryService } from './account-registry.service';
import { decodeJwtClaims } from '../utils/jwt-token.utils';

@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  private readonly accounts = inject(AccountRegistryService);

  get accessTokenValue(): string | null {
    return this.accounts.usableActiveAccountValue?.token ?? null;
  }

  setAccessToken(accessToken: string): void {
    const claims = decodeJwtClaims(accessToken);
    const uid = claims?.sub?.trim();
    if (!uid) {
      return;
    }

    this.accounts.addAccount(
      uid,
      claims?.email?.trim() ?? this.accounts.activeAccountValue?.email ?? '',
      accessToken,
      this.accounts.activeAccountValue?.uid === uid ? this.accounts.activeAccountValue.refreshToken : ''
    );
  }

  clear(): void {
    const activeAccount = this.accounts.activeAccountValue;
    if (!activeAccount) {
      this.accounts.logoutAll();
      return;
    }

    this.accounts.removeAccount(activeAccount.uid);
  }
}
