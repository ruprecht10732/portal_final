import { TestBed } from '@angular/core/testing';

import { AccountRegistryService } from './account-registry.service';

const buildToken = (payload: Record<string, unknown>): string => {
  const encode = (value: object) => btoa(JSON.stringify(value)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode(payload)}.signature`;
};

describe('AccountRegistryService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('adds accounts and marks the latest one active', () => {
    const service = TestBed.inject(AccountRegistryService);

    service.addAccount('user-a', 'a@example.com', buildToken({ sub: 'user-a', email: 'a@example.com', exp: Math.floor(Date.now() / 1000) + 3600 }), 'refresh-a');
    service.addAccount('user-b', 'b@example.com', buildToken({ sub: 'user-b', email: 'b@example.com', exp: Math.floor(Date.now() / 1000) + 3600 }), 'refresh-b');

    expect(service.accounts().length).toBe(2);
    expect(service.activeAccountValue?.uid).toBe('user-b');
    expect(service.accounts().find(account => account.uid === 'user-a')?.isActive).toBe(false);
    expect(JSON.parse(localStorage.getItem('portal.accountRegistry') ?? '[]')).toHaveLength(2);
  });

  it('switches and removes accounts while preserving the next active one', () => {
    const service = TestBed.inject(AccountRegistryService);

    service.addAccount('user-a', 'a@example.com', buildToken({ sub: 'user-a', email: 'a@example.com', exp: Math.floor(Date.now() / 1000) + 3600 }), 'refresh-a');
    service.addAccount('user-b', 'b@example.com', buildToken({ sub: 'user-b', email: 'b@example.com', exp: Math.floor(Date.now() / 1000) + 3600 }), 'refresh-b');

    expect(service.switchAccount('user-a')?.uid).toBe('user-a');

    const removal = service.removeAccount('user-a');

    expect(removal.removed).toBe(true);
    expect(removal.removedWasActive).toBe(true);
    expect(removal.nextActive?.uid).toBe('user-b');
    expect(service.activeAccountValue?.uid).toBe('user-b');
  });

  it('migrates the legacy access token storage into the registry', () => {
    const token = buildToken({ sub: 'legacy-user', email: 'legacy@example.com', exp: Math.floor(Date.now() / 1000) + 3600 });
    localStorage.setItem('portal.accessToken', token);

    const service = TestBed.inject(AccountRegistryService);

    expect(service.accounts()).toEqual([
      expect.objectContaining({
        uid: 'legacy-user',
        email: 'legacy@example.com',
        token,
        refreshToken: '',
        isActive: true,
      }),
    ]);
  });

  it('does not auto-expire an account just because the access token timestamp is old', () => {
    const service = TestBed.inject(AccountRegistryService);
    const expiredAccessToken = buildToken({ sub: 'user-a', email: 'a@example.com', exp: Math.floor(Date.now() / 1000) - 60 });

    service.addAccount('user-a', 'a@example.com', expiredAccessToken, 'refresh-a');

    expect(service.activeAccountValue?.isExpired).toBe(false);
    expect(service.usableActiveAccountValue?.uid).toBe('user-a');
  });

  it('marks expired accounts and finds the next usable account', () => {
    const service = TestBed.inject(AccountRegistryService);

    service.addAccount('user-a', 'a@example.com', buildToken({ sub: 'user-a', email: 'a@example.com', exp: Math.floor(Date.now() / 1000) + 3600 }), 'refresh-a');
    service.addAccount('user-b', 'b@example.com', buildToken({ sub: 'user-b', email: 'b@example.com', exp: Math.floor(Date.now() / 1000) + 3600 }), 'refresh-b');

    service.markExpired('user-b');

    expect(service.usableActiveAccountValue).toBeNull();
    expect(service.findNextAvailableAccount('user-b')?.uid).toBe('user-a');
  });
});