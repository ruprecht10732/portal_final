export interface SidebarPanelItem {
  label: string;
  route: string;
  icon?: string | null;
  exact?: boolean;
}

export interface SidebarPanelConfig {
  panelItems: SidebarPanelItem[];
}
