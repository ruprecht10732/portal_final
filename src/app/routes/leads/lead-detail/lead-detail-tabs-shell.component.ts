import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { TabItem } from '../../../shared/components/tab-bar/tab-bar.component';
import { CardComponent } from '../../../shared/components/card/card.component';
import { TabBarComponent } from '../../../shared/components/tab-bar/tab-bar.component';

@Component({
  selector: 'app-lead-detail-tabs-shell',
  templateUrl: './lead-detail-tabs-shell.component.html',
  styleUrl: './lead-detail-tabs-shell.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent, TabBarComponent],
})
export class LeadDetailTabsShellComponent {
  tabs = input<TabItem[]>([]);
  activeTab = input<string>('');
  variant = input<'pills' | 'underline'>('pills');

  tabChange = output<string>();
}
