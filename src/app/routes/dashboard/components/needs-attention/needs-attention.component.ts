import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ActionItemsComponent } from '../action-items/action-items.component';
import { DraftApprovalsComponent } from '../draft-approvals/draft-approvals.component';

type NeedsAttentionTab = 'actionItems' | 'draftApprovals';

@Component({
  selector: 'app-dashboard-needs-attention',
  imports: [TranslatePipe, ActionItemsComponent, DraftApprovalsComponent],
  templateUrl: './needs-attention.component.html',
  styleUrl: './needs-attention.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NeedsAttentionComponent {
  protected readonly activeTab = signal<NeedsAttentionTab>('actionItems');

  protected setTab(tab: NeedsAttentionTab): void {
    this.activeTab.set(tab);
  }
}
