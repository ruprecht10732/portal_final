import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

export interface TabItem {
  id: string;
  label: string;
  icon?: string;
  badge?: number | string;
}

@Component({
  selector: 'shared-tab-bar',
  templateUrl: './tab-bar.component.html',
  styleUrl: './tab-bar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabBarComponent {
  tabs = input.required<TabItem[]>();
  activeTab = input.required<string>();
  size = input<'sm' | 'md'>('md');
  variant = input<'pills' | 'underline'>('pills');

  tabChange = output<string>();

  protected readonly tabsWithState = computed(() =>
    this.tabs().map(tab => ({
      ...tab,
      isActive: tab.id === this.activeTab(),
    }))
  );

  protected readonly containerClass = computed(() => {
    const base = 'flex gap-1';
    const variantClass = this.variant() === 'underline' 
      ? 'border-b border-zinc-200'
      : 'bg-zinc-100 p-1 rounded-xl';
    return `${base} ${variantClass}`;
  });

  protected getTabClass(isActive: boolean): string {
    const base = 'relative flex items-center gap-2 font-medium transition-all duration-200';
    
    const sizeClass = this.size() === 'sm' 
      ? 'px-3 py-2 text-xs' 
      : 'px-4 py-2.5 text-sm';
    
    if (this.variant() === 'underline') {
      return `${base} ${sizeClass} ${isActive 
        ? 'text-zinc-900 border-b-2 border-zinc-900 -mb-px' 
        : 'text-zinc-500 hover:text-zinc-700 border-b-2 border-transparent'}`;
    }
    
    return `${base} ${sizeClass} rounded-lg ${isActive 
      ? 'bg-white text-zinc-900 shadow-sm' 
      : 'text-zinc-600 hover:text-zinc-900 hover:bg-white/50'}`;
  }

  selectTab(tabId: string): void {
    this.tabChange.emit(tabId);
  }
}
