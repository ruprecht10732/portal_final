import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, switchMap, from, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse } from './auth.service';
import { AccountRegistryService } from './account-registry.service';
import { decodeJwtClaims } from '../utils/jwt-token.utils';

export interface PasskeyInfo {
  id: string;
  nickname: string;
  createdAt: string;
  lastUsedAt?: string;
}

@Injectable({ providedIn: 'root' })
export class WebAuthnService {
  private readonly http = inject(HttpClient);
  private readonly accounts = inject(AccountRegistryService);
  private readonly baseUrl = environment.apiBaseUrl;

  readonly isSupported = globalThis.window !== undefined &&
    !!globalThis.PublicKeyCredential &&
    typeof globalThis.PublicKeyCredential === 'function';

  // ---------------------------------------------------------------------------
  // Registration (add passkey – authenticated)
  // ---------------------------------------------------------------------------

  beginRegistration(nickname: string): Observable<void> {
    return this.http
      .post<{ publicKey: PublicKeyCredentialCreationOptions }>(`${this.baseUrl}/users/me/passkeys/register/begin`, {})
      .pipe(
        switchMap(resp => from(this.createCredential(resp.publicKey))),
        switchMap(credential =>
          this.http.post<{ message: string }>(
            `${this.baseUrl}/users/me/passkeys/register/finish`,
            { nickname, credential },
          ),
        ),
        map(() => void 0),
      );
  }

  // ---------------------------------------------------------------------------
  // Login (discoverable / passkey login – public)
  // ---------------------------------------------------------------------------

  beginLogin(): Observable<AuthResponse> {
    return this.http
      .post<{ publicKey: PublicKeyCredentialRequestOptions & { challenge: string } }>(
        `${this.baseUrl}/auth/passkey/login/begin`,
        {},
        { withCredentials: true },
      )
      .pipe(
        switchMap(resp => {
          const challenge = resp.publicKey.challenge;
          return from(this.getCredential(resp.publicKey)).pipe(
            map(credential => ({ challenge, credential })),
          );
        }),
        switchMap(payload =>
          this.http.post<AuthResponse>(
            `${this.baseUrl}/auth/passkey/login/finish`,
            payload,
            { withCredentials: true },
          ),
        ),
        tap(response => {
          const claims = decodeJwtClaims(response.accessToken);
          const uid = claims?.sub?.trim();
          if (uid) {
            this.accounts.addAccount(uid, claims?.email?.trim() || '', response.accessToken, response.refreshToken);
          }
        }),
      );
  }

  // ---------------------------------------------------------------------------
  // Management (authenticated)
  // ---------------------------------------------------------------------------

  listPasskeys(): Observable<PasskeyInfo[]> {
    return this.http.get<PasskeyInfo[]>(`${this.baseUrl}/users/me/passkeys`);
  }

  renamePasskey(id: string, nickname: string): Observable<void> {
    return this.http
      .patch<{ message: string }>(`${this.baseUrl}/users/me/passkeys/${encodeURIComponent(id)}`, { nickname })
      .pipe(map(() => void 0));
  }

  deletePasskey(id: string): Observable<void> {
    return this.http
      .delete<{ message: string }>(`${this.baseUrl}/users/me/passkeys/${encodeURIComponent(id)}`)
      .pipe(map(() => void 0));
  }

  // ---------------------------------------------------------------------------
  // Browser WebAuthn API helpers
  // ---------------------------------------------------------------------------

  private async createCredential(options: PublicKeyCredentialCreationOptions): Promise<unknown> {
    // The server sends base64url-encoded binary fields – decode them.
    const publicKey = {
      ...options,
      challenge: this.base64urlToBuffer(options.challenge as unknown as string),
      user: {
        ...options.user,
        id: this.base64urlToBuffer(options.user.id as unknown as string),
      },
      excludeCredentials: (options.excludeCredentials ?? []).map(c => ({
        ...c,
        id: this.base64urlToBuffer(c.id as unknown as string),
      })),
    };

    const credential = (await navigator.credentials.create({ publicKey })) as PublicKeyCredential;
    const response = credential.response as AuthenticatorAttestationResponse;

    return {
      id: credential.id,
      rawId: this.bufferToBase64url(credential.rawId),
      type: credential.type,
      response: {
        attestationObject: this.bufferToBase64url(response.attestationObject),
        clientDataJSON: this.bufferToBase64url(response.clientDataJSON),
      },
    };
  }

  private async getCredential(options: PublicKeyCredentialRequestOptions): Promise<unknown> {
    const publicKey = {
      ...options,
      challenge: this.base64urlToBuffer(options.challenge as unknown as string),
      allowCredentials: (options.allowCredentials ?? []).map(c => ({
        ...c,
        id: this.base64urlToBuffer(c.id as unknown as string),
      })),
    };

    const credential = (await navigator.credentials.get({ publicKey })) as PublicKeyCredential;
    const response = credential.response as AuthenticatorAssertionResponse;

    return {
      id: credential.id,
      rawId: this.bufferToBase64url(credential.rawId),
      type: credential.type,
      response: {
        authenticatorData: this.bufferToBase64url(response.authenticatorData),
        clientDataJSON: this.bufferToBase64url(response.clientDataJSON),
        signature: this.bufferToBase64url(response.signature),
        userHandle: response.userHandle ? this.bufferToBase64url(response.userHandle) : null,
      },
    };
  }

  private base64urlToBuffer(value: string): ArrayBuffer {
    const base64 = value.replaceAll('-', '+').replaceAll('_', '/');
    const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.codePointAt(i)!;
    }
    return bytes.buffer;
  }

  private bufferToBase64url(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (const byte of bytes) {
      binary += String.fromCodePoint(byte);
    }
    return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  }
}
