import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { AuthService } from './auth.service';
import { AccountRegistryService } from './account-registry.service';
import { environment } from '../../../environments/environment';

const buildToken = (payload: Record<string, unknown>): string => {
  const encode = (value: object) => btoa(JSON.stringify(value)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode(payload)}.signature`;
};

const buildSignInPayload = () => ({
  email: 'user-a@example.com',
  password: ['sample', 'login', 'value'].join('-'),
});

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let registry: AccountRegistryService;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        AuthService,
        AccountRegistryService,
      ],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
    registry = TestBed.inject(AccountRegistryService);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('stores a signed-in account in the registry', () => {
    const accessToken = buildToken({ sub: 'user-a', email: 'user-a@example.com', exp: Math.floor(Date.now() / 1000) + 3600 });

    service.signIn(buildSignInPayload()).subscribe();

    const request = httpMock.expectOne(`${environment.apiBaseUrl}/auth/sign-in`);
    expect(request.request.method).toBe('POST');
    expect(request.request.withCredentials).toBe(true);
    request.flush({ accessToken, refreshToken: 'refresh-a' });

    expect(registry.activeAccountValue).toEqual(expect.objectContaining({
      uid: 'user-a',
      email: 'user-a@example.com',
      token: accessToken,
      refreshToken: 'refresh-a',
    }));
  });

  it('refreshes a specific account using the body token flow', () => {
    const originalToken = buildToken({ sub: 'user-a', email: 'user-a@example.com', exp: Math.floor(Date.now() / 1000) + 3600 });
    const refreshedToken = buildToken({ sub: 'user-a', email: 'updated@example.com', exp: Math.floor(Date.now() / 1000) + 7200 });
    registry.addAccount('user-a', 'user-a@example.com', originalToken, 'refresh-a');

    service.refresh('refresh-a').subscribe();

    const request = httpMock.expectOne(`${environment.apiBaseUrl}/auth/refresh`);
    expect(request.request.method).toBe('POST');
    expect(request.request.withCredentials).toBe(false);
    expect(request.request.body).toEqual({ refreshToken: 'refresh-a' });
    request.flush({ accessToken: refreshedToken, refreshToken: 'refresh-b' });

    expect(registry.activeAccountValue).toEqual(expect.objectContaining({
      uid: 'user-a',
      email: 'updated@example.com',
      token: refreshedToken,
      refreshToken: 'refresh-b',
    }));
  });

  it('sends explicit authorization when verifying a token', () => {
    const token = buildToken({ sub: 'user-a', email: 'user-a@example.com', exp: Math.floor(Date.now() / 1000) + 3600 });

    service.verifyToken(token).subscribe();

    const request = httpMock.expectOne(`${environment.apiBaseUrl}/auth/verify`);
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe(`Bearer ${token}`);
    request.flush({ valid: true, userId: 'user-a', email: 'user-a@example.com' });
  });

  it('sends the active access token when signing out a specific account', () => {
    const token = buildToken({ sub: 'user-a', email: 'user-a@example.com', exp: Math.floor(Date.now() / 1000) + 3600 });
    registry.addAccount('user-a', 'user-a@example.com', token, 'refresh-a');

    service.signOut('refresh-a').subscribe();

    const request = httpMock.expectOne(`${environment.apiBaseUrl}/auth/sign-out`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ refreshToken: 'refresh-a' });
    expect(request.request.headers.get('Authorization')).toBe(`Bearer ${token}`);
    request.flush({ message: 'signed out' });
  });

  it('revokes every stored account during sign out all', () => {
    const tokenA = buildToken({ sub: 'user-a', email: 'user-a@example.com', exp: Math.floor(Date.now() / 1000) + 3600 });
    const tokenB = buildToken({ sub: 'user-b', email: 'user-b@example.com', exp: Math.floor(Date.now() / 1000) + 3600 });
    registry.addAccount('user-a', 'user-a@example.com', tokenA, 'refresh-a');
    registry.addAccount('user-b', 'user-b@example.com', tokenB, 'refresh-b');

    service.signOutAllAccounts().subscribe();

    const requests = httpMock.match(`${environment.apiBaseUrl}/auth/sign-out`);
    expect(requests).toHaveLength(2);
    expect(requests[0]?.request.headers.get('Authorization')).toBe(`Bearer ${tokenA}`);
    expect(requests[1]?.request.headers.get('Authorization')).toBe(`Bearer ${tokenB}`);
    expect(requests[0]?.request.body).toEqual({ refreshToken: 'refresh-a' });
    expect(requests[1]?.request.body).toEqual({ refreshToken: 'refresh-b' });
    requests[0]?.flush({ message: 'signed out' });
    requests[1]?.flush({ message: 'signed out' });
  });
});