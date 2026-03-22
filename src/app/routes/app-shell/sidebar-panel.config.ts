export interface SidebarPanelItem {
  label: string;
  route: string;
  icon?: string | null;
  exact?: boolean;
  group?: string;
  roles?: string[];
}

export interface SidebarPanelConfig {
  panelItems: SidebarPanelItem[];
}
