import type { UserProfile } from '../../core/services/user.types';

export interface NavItem {
  label: string;
  route: string;
  matchPrefixes?: readonly string[];
  icon: string;
}

export function buildNavItems(isSuperAdmin: boolean): NavItem[] {
  const base: NavItem[] = [
    { label: 'navigation.dashboard', route: '/app/dashboard', icon: 'dashboard' },
    { label: 'navigation.leads', route: '/app/leads', icon: 'leads' },
    { label: 'navigation.messages', route: '/app/inbox', icon: 'inbox' },
    { label: 'navigation.offertes', route: '/app/offertes', icon: 'offertes' },
    { label: 'navigation.appointments', route: '/app/appointments', icon: 'appointments' },
    { label: 'navigation.partners', route: '/app/partners', matchPrefixes: ['/app/offers'], icon: 'partners' },
    { label: 'navigation.tasks', route: '/app/tasks', icon: 'tasks' },
    { label: 'navigation.settings', route: '/app/settings', icon: 'settings' },
  ];
  if (isSuperAdmin) {
    base.push({ label: 'navigation.agentWhatsApp', route: '/app/agent-whatsapp', icon: 'agentWhatsapp' });
  }
  return base;
}

export function computeUserInitials(user: UserProfile | null): string {
  if (!user) return '?';
  const first = user.firstName?.trim().charAt(0).toUpperCase() ?? '';
  const last = user.lastName?.trim().charAt(0).toUpperCase() ?? '';
  return first + last || user.email.charAt(0).toUpperCase();
}

const AVATAR_COLORS = [
  '#e53935', '#d81b60', '#8e24aa', '#5e35b1',
  '#1e88e5', '#039be5', '#00897b', '#43a047',
  '#f4511e', '#fb8c00', '#fdd835', '#6d4c41',
];

export function computeAvatarColor(user: UserProfile | null): string {
  const seed = user ? (user.firstName ?? user.email) : '';
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (seed.codePointAt(i) ?? 0) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length] ?? '#1e88e5';
}

export function isNavItemActive(currentUrl: string, item: Pick<NavItem, 'route' | 'matchPrefixes'>): boolean {
  if (currentUrl === item.route || currentUrl.startsWith(item.route + '/')) return true;
  return item.matchPrefixes?.some((prefix) => currentUrl === prefix || currentUrl.startsWith(prefix + '/')) ?? false;
}
