import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { signal } from '@angular/core';
import { of, Subject, throwError } from 'rxjs';

import { AccountRegistryService } from '../../core/services/account-registry.service';
import { AuthService } from '../../core/services/auth.service';
import { IMAPUnreadCountService } from '../../core/services/imap-unread-count.service';
import { NotificationsService } from '../../core/services/notifications.service';
import { UserService } from '../../core/services/user.service';
import { WhatsAppUnreadCountService } from '../../core/services/whatsapp-unread-count.service';
import type { UserProfile } from '../../core/services/user.types';
import { AuthenticatedSidebarComponent } from './authenticated-sidebar.component';

const buildToken = (payload: Record<string, unknown>): string => {
  const encode = (value: object) => btoa(JSON.stringify(value)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode(payload)}.signature`;
};

const createProfile = (): UserProfile => ({
  id: 'user-a',
  email: 'user-a@example.com',
  phone: null,
  emailVerified: true,
  firstName: 'Dev',
  lastName: 'User',
  preferredLanguage: 'nl',
  roles: ['admin'],
  hasOrganization: true,
  onboardingCompleted: true,
  createdAt: '2026-03-17T00:00:00Z',
  updatedAt: '2026-03-17T00:00:00Z',
});

const instantiateSidebarComponent = (): AuthenticatedSidebarComponent =>
  TestBed.runInInjectionContext(() => new AuthenticatedSidebarComponent());

describe('AuthenticatedSidebarComponent', () => {
  let accountRegistry: AccountRegistryService;
  let authService: { signOut: ReturnType<typeof vi.fn>; signOutAllAccounts: ReturnType<typeof vi.fn>; refresh: ReturnType<typeof vi.fn> };
  let router: { events: Subject<NavigationEnd>; url: string; navigate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    localStorage.clear();

    router = {
      events: new Subject<NavigationEnd>(),
      url: '/app/dashboard',
      navigate: vi.fn().mockResolvedValue(true),
    };

    authService = {
      signOut: vi.fn().mockReturnValue(of({ message: 'signed out' })),
      signOutAllAccounts: vi.fn().mockReturnValue(of([{ message: 'signed out' }, { message: 'signed out' }])),
      refresh: vi.fn().mockReturnValue(of({ accessToken: buildToken({ sub: 'user-b', email: 'user-b@example.com', exp: Math.floor(Date.now() / 1000) + 3600 }), refreshToken: 'refresh-b-next' })),
    };

    TestBed.configureTestingModule({
      providers: [
        AccountRegistryService,
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: { root: { snapshot: {}, firstChild: null } } },
        { provide: AuthService, useValue: authService },
        {
          provide: NotificationsService,
          useValue: { unreadLeadCount: signal(0), unreadQuoteCount: signal(0) },
        },
        { provide: IMAPUnreadCountService, useValue: { unreadCount: signal(0) } },
        { provide: WhatsAppUnreadCountService, useValue: { unreadCount: signal(0) } },
        { provide: UserService, useValue: { getProfile: () => of(createProfile()) } },
      ],
    });

    accountRegistry = TestBed.inject(AccountRegistryService);
  });

  afterEach(() => {
    localStorage.clear();
  });
  it('builds the profile menu with account state badges and sign out all action', () => {
    accountRegistry.addAccount('user-a', 'user-a@example.com', buildToken({ sub: 'user-a', email: 'user-a@example.com', exp: Math.floor(Date.now() / 1000) + 3600 }), 'refresh-a');
    accountRegistry.addAccount('user-b', 'user-b@example.com', buildToken({ sub: 'user-b', email: 'user-b@example.com', exp: Math.floor(Date.now() / 1000) + 3600 }), 'refresh-b');
    accountRegistry.markExpired('user-a');

    const component = instantiateSidebarComponent();
    const sections = component['profileMenu']();

    expect(sections[0]?.items).toEqual([
      expect.objectContaining({
        label: 'user-a@example.com',
        badge: 'auth.account.sessionExpired',
        tone: 'danger',
        disabled: true,
      }),
      expect.objectContaining({
        label: 'user-b@example.com',
        detail: 'auth.account.current',
        disabled: true,
      }),
    ]);
    expect(sections[1]?.items).toContainEqual(expect.objectContaining({ value: 'sign-out-all' }));
  });

  it('opens the add-account sheet from the profile menu action', () => {
    accountRegistry.addAccount('user-a', 'user-a@example.com', buildToken({ sub: 'user-a', email: 'user-a@example.com', exp: Math.floor(Date.now() / 1000) + 3600 }), 'refresh-a');
    const component = instantiateSidebarComponent();

    component['handleProfileMenuSelection']({ label: 'auth.account.addAccount', value: 'add-account' });

    expect(component['showAddAccountSheet']()).toBe(true);
  });

  it('signs out the current account and navigates to sign-in when none remain', () => {
    accountRegistry.addAccount('user-a', 'user-a@example.com', buildToken({ sub: 'user-a', email: 'user-a@example.com', exp: Math.floor(Date.now() / 1000) + 3600 }), 'refresh-a');
    const component = instantiateSidebarComponent();

    component['handleProfileMenuSelection']({ label: 'auth.account.signOutCurrent', value: 'sign-out-current' });

    expect(authService.signOut).toHaveBeenCalledWith('refresh-a');
    expect(accountRegistry.accounts()).toEqual([]);
    expect(router.navigate).toHaveBeenCalledWith(['/sign-in']);
  });

  it('signs out all accounts and navigates to sign-in', () => {
    accountRegistry.addAccount('user-a', 'user-a@example.com', buildToken({ sub: 'user-a', email: 'user-a@example.com', exp: Math.floor(Date.now() / 1000) + 3600 }), 'refresh-a');
    accountRegistry.addAccount('user-b', 'user-b@example.com', buildToken({ sub: 'user-b', email: 'user-b@example.com', exp: Math.floor(Date.now() / 1000) + 3600 }), 'refresh-b');
    const component = instantiateSidebarComponent();

    component['handleProfileMenuSelection']({ label: 'auth.account.signOutAll', value: 'sign-out-all' });

    expect(authService.signOutAllAccounts).toHaveBeenCalled();
    expect(accountRegistry.accounts()).toEqual([]);
    expect(router.navigate).toHaveBeenCalledWith(['/sign-in']);
  });

  it('tries to refresh a stale inactive account before marking it expired', () => {
    accountRegistry.addAccount('user-a', 'user-a@example.com', buildToken({ sub: 'user-a', email: 'user-a@example.com', exp: Math.floor(Date.now() / 1000) + 3600 }), 'refresh-a');
    accountRegistry.addAccount('user-b', 'user-b@example.com', buildToken({ sub: 'user-b', email: 'user-b@example.com', exp: Math.floor(Date.now() / 1000) - 60 }), 'refresh-b');
    accountRegistry.switchAccount('user-a');
    authService.refresh.mockReturnValueOnce(throwError(() => new Error('refresh failed')));

    const component = instantiateSidebarComponent();

    component['handleProfileMenuSelection']({ label: 'user-b@example.com', value: 'switch:user-b' });

    expect(authService.refresh).toHaveBeenCalledWith('refresh-b');
    expect(accountRegistry.getAccount('user-b')?.isExpired).toBe(true);
    expect(accountRegistry.activeAccountValue?.uid).toBe('user-a');
  });
});