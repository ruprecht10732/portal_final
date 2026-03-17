import { computed, Injectable, signal } from '@angular/core';
import { decodeJwtClaims, isJwtExpired } from '../utils/jwt-token.utils';

const ACCOUNT_REGISTRY_KEY = 'portal.accountRegistry';
const LEGACY_ACCESS_TOKEN_KEY = 'portal.accessToken';

export interface Account {
  uid: string;
  email: string;
  token: string;
  refreshToken: string;
  isActive: boolean;
  isExpired: boolean;
}

export interface AccountRemovalResult {
  removed: boolean;
  removedWasActive: boolean;
  nextActive: Account | null;
}

@Injectable({ providedIn: 'root' })
export class AccountRegistryService {
  private readonly registryState = signal<Account[]>(this.loadRegistry());

  readonly accounts = computed(() => this.registryState());
  readonly activeAccount = computed(() => this.registryState().find(account => account.isActive) ?? null);

  get activeAccountValue(): Account | null {
    return this.activeAccount();
  }

  get usableActiveAccountValue(): Account | null {
    const activeAccount = this.activeAccount();
    return activeAccount && !activeAccount.isExpired ? activeAccount : null;
  }

  addAccount(uid: string, email: string, token: string, refreshToken: string): Account {
    const nextRegistry = this.registryState()
      .filter(account => account.uid !== uid)
      .map(account => ({ ...account, isActive: false }));

    const account: Account = {
      uid,
      email: email.trim(),
      token,
      refreshToken,
      isActive: true,
      isExpired: isJwtExpired(token),
    };

    this.replaceRegistry([...nextRegistry, account]);
    return account;
  }

  switchAccount(uid: string): Account | null {
    const targetAccount = this.registryState().find(account => account.uid === uid && !account.isExpired) ?? null;
    if (!targetAccount) {
      return null;
    }

    this.replaceRegistry(
      this.registryState().map(account => ({
        ...account,
        isActive: account.uid === uid,
      }))
    );

    return this.activeAccountValue;
  }

  removeAccount(uid: string): AccountRemovalResult {
    const currentRegistry = this.registryState();
    const removedAccount = currentRegistry.find(account => account.uid === uid);
    if (!removedAccount) {
      return { removed: false, removedWasActive: false, nextActive: this.activeAccountValue };
    }

    const nextRegistry = currentRegistry.filter(account => account.uid !== uid);
    const nextActiveUID = removedAccount.isActive
      ? (nextRegistry.find(account => !account.isExpired)?.uid ?? nextRegistry[0]?.uid ?? null)
      : (currentRegistry.find(account => account.isActive && account.uid !== uid)?.uid ?? nextRegistry[0]?.uid ?? null);

    this.replaceRegistry(
      nextRegistry.map(account => ({
        ...account,
        isActive: account.uid === nextActiveUID,
      }))
    );

    return {
      removed: true,
      removedWasActive: removedAccount.isActive,
      nextActive: this.activeAccountValue,
    };
  }

  updateTokens(uid: string, token: string, refreshToken: string, email?: string): void {
    this.replaceRegistry(
      this.registryState().map(account =>
        account.uid === uid
          ? {
            ...account,
            email: email?.trim() || account.email,
            token,
            refreshToken,
            isExpired: isJwtExpired(token),
          }
          : account
      )
    );
  }

  updateEmail(uid: string, email: string): void {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      return;
    }

    this.replaceRegistry(
      this.registryState().map(account =>
        account.uid === uid
          ? { ...account, email: normalizedEmail }
          : account
      )
    );
  }

  markExpired(uid: string): void {
    this.replaceRegistry(
      this.registryState().map(account =>
        account.uid === uid
          ? { ...account, isExpired: true }
          : account
      )
    );
  }

  logoutAll(): void {
    try {
      localStorage.removeItem(ACCOUNT_REGISTRY_KEY);
      localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
    } catch {
      // ignore storage errors
    }
    this.registryState.set([]);
  }

  findNextAvailableAccount(excludedUID?: string): Account | null {
    return this.registryState().find(account => account.uid !== excludedUID && !account.isExpired) ?? null;
  }

  getUsableAccount(uid: string): Account | null {
    const normalizedUID = uid.trim();
    if (!normalizedUID) {
      return null;
    }

    const account = this.registryState().find(item => item.uid === normalizedUID) ?? null;
    return account && !account.isExpired ? account : null;
  }

  private replaceRegistry(accounts: Account[]): void {
    const normalized = this.normalizeRegistry(accounts);
    this.registryState.set(normalized);

    try {
      if (normalized.length === 0) {
        localStorage.removeItem(ACCOUNT_REGISTRY_KEY);
        localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
        return;
      }

      localStorage.setItem(ACCOUNT_REGISTRY_KEY, JSON.stringify(normalized));
      localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
    } catch {
      // ignore storage errors
    }
  }

  private loadRegistry(): Account[] {
    try {
      const raw = localStorage.getItem(ACCOUNT_REGISTRY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return this.normalizeRegistry(parsed);
        }
      }
    } catch {
      // ignore malformed storage
    }

    const migratedAccount = this.migrateLegacyToken();
    return migratedAccount ? [migratedAccount] : [];
  }

  private migrateLegacyToken(): Account | null {
    try {
      const token = localStorage.getItem(LEGACY_ACCESS_TOKEN_KEY);
      if (!token) {
        return null;
      }

      const claims = decodeJwtClaims(token);
      const uid = claims?.sub?.trim();
      if (!uid) {
        return null;
      }

      return {
        uid,
        email: claims?.email?.trim() ?? '',
        token,
        refreshToken: '',
        isActive: true,
        isExpired: isJwtExpired(token),
      };
    } catch {
      return null;
    }
  }

  private normalizeRegistry(accounts: unknown[]): Account[] {
    const normalized = accounts
      .map(account => this.normalizeAccount(account))
      .filter((account): account is Account => account !== null);

    if (normalized.length === 0) {
      return [];
    }

    const fallbackAccount = normalized[0];
    if (!fallbackAccount) {
      return [];
    }

    const activeUID = normalized.find(account => account.isActive)?.uid ?? normalized.find(account => !account.isExpired)?.uid ?? fallbackAccount.uid;
    return normalized.map(account => ({
      ...account,
      isActive: account.uid === activeUID,
      isExpired: account.isExpired || isJwtExpired(account.token),
    }));
  }

  private normalizeAccount(account: unknown): Account | null {
    if (!account || typeof account !== 'object') {
      return null;
    }

    const candidate = account as Partial<Account>;
    const uid = typeof candidate.uid === 'string' ? candidate.uid.trim() : '';
    const token = typeof candidate.token === 'string' ? candidate.token.trim() : '';
    if (!uid || !token) {
      return null;
    }

    return {
      uid,
      email: typeof candidate.email === 'string' ? candidate.email.trim() : '',
      token,
      refreshToken: typeof candidate.refreshToken === 'string' ? candidate.refreshToken : '',
      isActive: !!candidate.isActive,
      isExpired: !!candidate.isExpired,
    };
  }
}