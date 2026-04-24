import { ActivatedRoute } from '@angular/router';
import { SidebarPanelItem } from './sidebar-panel.config';

export function resolvePanelItems(route: ActivatedRoute): SidebarPanelItem[] {
  let current: ActivatedRoute | null = route.root;
  let items: SidebarPanelItem[] = [];
  while (current) {
    if (current.snapshot?.data?.['panelItems']) {
      items = current.snapshot.data['panelItems'];
    }
    current = current.firstChild;
  }
  return items;
}

export function filterPanelItemsForCurrentUser(items: SidebarPanelItem[], roles: string[]): SidebarPanelItem[] {
  return items.filter((item) => {
    if (!item.roles || item.roles.length === 0) return true;
    return item.roles.some((role) => roles.includes(role));
  });
}

export function isRouteActive(url: string, route: string): boolean {
  return url.startsWith(route);
}

export function isRouteExact(url: string, route: string): boolean {
  return url === route;
}
