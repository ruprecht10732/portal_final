import { computed, Injectable, signal, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { decodeJwtClaims } from '../utils/jwt-token.utils';

const STORAGE_KEYS = {
  REGISTRY: 'portal.accountRegistry',
  LEGACY_TOKEN: 'portal.accessToken',
} as const;

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
  // SSR Safety check
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  
  // Single source of truth
  private readonly state = signal<Account[]>(this.initializeRegistry());

  // Public reactive state
  readonly accounts = this.state.asReadonly();
  readonly activeAccount = computed(() => this.state().find(a => a.isActive) ?? null);
  readonly usableActiveAccount = computed(() => {
    const active = this.activeAccount();
    return active && !active.isExpired ? active : null;
  });

  addAccount(uid: string, email: string, token: string, refreshToken: string): Account {
    const newAccount: Account = {
      uid,
      email: email.trim(),
      token,
      refreshToken,
      isActive: true,
      isExpired: false,
    };

    this.updateState(current => {
      const filtered = current.filter(a => a.uid !== uid).map(a => ({ ...a, isActive: false }));
      return [...filtered, newAccount];
    });

    return newAccount;
  }

  switchAccount(uid: string): Account | null {
    const targetExists = this.state().some(a => a.uid === uid && !a.isExpired);
    if (!targetExists) return null;

    this.updateState(current =>
      current.map(a => ({ ...a, isActive: a.uid === uid }))
    );

    return this.activeAccount();
  }

  removeAccount(uid: string): AccountRemovalResult {
    const current = this.state();
    const removedAccount = current.find(a => a.uid === uid);

    if (!removedAccount) {
      return { removed: false, removedWasActive: false, nextActive: this.activeAccount() };
    }

    this.updateState(state => state.filter(a => a.uid !== uid));

    return {
      removed: true,
      removedWasActive: removedAccount.isActive,
      nextActive: this.activeAccount(),
    };
  }

  updateTokens(uid: string, token: string, refreshToken: string, email?: string): void {
    this.updateState(current =>
      current.map(a =>
        a.uid === uid
          ? { ...a, token, refreshToken, isExpired: false, email: email?.trim() || a.email }
          : a
      )
    );
  }

  updateEmail(uid: string, email: string): void {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) return;

    this.updateState(current =>
      current.map(a => (a.uid === uid ? { ...a, email: normalizedEmail } : a))
    );
  }

  markExpired(uid: string): void {
    this.updateState(current =>
      current.map(a => (a.uid === uid ? { ...a, isExpired: true } : a))
    );
  }

  logoutAll(): void {
    if (this.isBrowser) {
      try {
        localStorage.removeItem(STORAGE_KEYS.REGISTRY);
        localStorage.removeItem(STORAGE_KEYS.LEGACY_TOKEN);
      } catch {
        // ignore storage errors
      }
    }
    this.state.set([]);
  }

  getAccount(uid: string): Account | null {
    const normalizedUid = uid.trim();
    return normalizedUid ? (this.state().find(a => a.uid === normalizedUid) ?? null) : null;
  }

  getUsableAccount(uid: string): Account | null {
    const account = this.getAccount(uid);
    return account && !account.isExpired ? account : null;
  }

  findNextAvailableAccount(excludedUID?: string): Account | null {
    return this.state().find(a => a.uid !== excludedUID && !a.isExpired) ?? null;
  }

  // --- Private Implementation Details ---

  /**
   * Central pipeline for all state mutations. 
   * Ensures business rules and storage sync are always applied.
   */
  private updateState(updaterFn: (currentAccounts: Account[]) => Account[]): void {
    const newState = updaterFn(this.state());
    const regulatedState = this.enforceBusinessRules(newState);
    
    this.state.set(regulatedState);
    this.syncToStorage(regulatedState);
  }

  /**
   * Ensures data integrity (e.g., there is exactly one active account if the array is not empty).
   */
  private enforceBusinessRules(accounts: Account[]): Account[] {
    if (accounts.length === 0) return [];

    let hasActive = accounts.some(a => a.isActive);
    let activeUid = hasActive ? accounts.find(a => a.isActive)?.uid : null;

    // Elect a new active account if none exists
    if (!activeUid) {
      // The '!' guarantees to TS that this array is not empty, which we proved on line 161.
      const candidate = accounts.find(a => !a.isExpired) ?? accounts[0]!;
      activeUid = candidate.uid;
    }

    return accounts.map(a => ({
      ...a,
      isActive: a.uid === activeUid,
    }));
  }

  private initializeRegistry(): Account[] {
    if (!this.isBrowser) return [];

    try {
      const raw = localStorage.getItem(STORAGE_KEYS.REGISTRY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const validated = parsed.map(a => this.parseAccount(a)).filter((a): a is Account => a !== null);
          return this.enforceBusinessRules(validated);
        }
      }
    } catch {
      // ignore malformed storage
    }

    const migrated = this.migrateLegacyToken();
    return migrated ? this.enforceBusinessRules([migrated]) : [];
  }

  private syncToStorage(accounts: Account[]): void {
    if (!this.isBrowser) return;

    try {
      if (accounts.length === 0) {
        localStorage.removeItem(STORAGE_KEYS.REGISTRY);
      } else {
        localStorage.setItem(STORAGE_KEYS.REGISTRY, JSON.stringify(accounts));
      }
      // Always clean up legacy token if we are mutating modern state
      localStorage.removeItem(STORAGE_KEYS.LEGACY_TOKEN);
    } catch {
      // ignore storage errors
    }
  }

  private parseAccount(account: unknown): Account | null {
    if (!account || typeof account !== 'object') return null;

    const candidate = account as Partial<Account>;
    const uid = typeof candidate.uid === 'string' ? candidate.uid.trim() : '';
    const token = typeof candidate.token === 'string' ? candidate.token.trim() : '';

    if (!uid || !token) return null;

    return {
      uid,
      email: typeof candidate.email === 'string' ? candidate.email.trim() : '',
      token,
      refreshToken: typeof candidate.refreshToken === 'string' ? candidate.refreshToken : '',
      isActive: !!candidate.isActive,
      isExpired: !!candidate.isExpired,
    };
  }

  private migrateLegacyToken(): Account | null {
    try {
      const token = localStorage.getItem(STORAGE_KEYS.LEGACY_TOKEN);
      if (!token) return null;

      const claims = decodeJwtClaims(token);
      const uid = claims?.sub?.trim();
      
      if (!uid) return null;

      return {
        uid,
        email: claims?.email?.trim() ?? '',
        token,
        refreshToken: '',
        isActive: true,
        isExpired: false,
      };
    } catch {
      return null;
    }
  }
}