import { Injectable, signal } from '@angular/core';

const ACCESS_TOKEN_KEY = 'portal.accessToken';

@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  private readonly accessToken = signal<string | null>(this.readToken(ACCESS_TOKEN_KEY));

  get accessTokenValue(): string | null {
    return this.accessToken();
  }

  setAccessToken(accessToken: string): void {
    this.accessToken.set(accessToken);
    this.writeToken(ACCESS_TOKEN_KEY, accessToken);
  }

  clear(): void {
    this.accessToken.set(null);
    this.removeToken(ACCESS_TOKEN_KEY);
  }

  private readToken(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private writeToken(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // ignore storage errors (e.g., private mode)
    }
  }

  private removeToken(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore storage errors
    }
  }
}
