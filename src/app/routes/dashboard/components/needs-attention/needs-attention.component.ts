import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ActionItemsComponent } from '../action-items/action-items.component';
import { DraftApprovalsComponent } from '../draft-approvals/draft-approvals.component';
import { StaleLeadsComponent } from '../stale-leads/stale-leads.component';

type NeedsAttentionTab = 'actionItems' | 'draftApprovals' | 'staleLeads';

@Component({
  selector: 'app-dashboard-needs-attention',
  imports: [TranslatePipe, ActionItemsComponent, DraftApprovalsComponent, StaleLeadsComponent],
  templateUrl: './needs-attention.component.html',
  styleUrl: './needs-attention.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block w-full xl:flex xl:min-h-0 xl:flex-col' },
})
export class NeedsAttentionComponent {
  protected readonly activeTab = signal<NeedsAttentionTab>('actionItems');

  protected setTab(tab: NeedsAttentionTab): void {
    this.activeTab.set(tab);
  }
}
