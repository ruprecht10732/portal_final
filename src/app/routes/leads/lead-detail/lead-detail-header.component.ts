import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { Lead, LeadStatus, PipelineStage } from '../../../core/services/leads.types';
import type { SelectOption } from '../../../shared/components/select/select.component';
import { ChipComponent, type ChipVariant } from '../../../shared/components/chip/chip.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { MenuComponent, type MenuItem, type MenuSection } from '../../../shared/components/menu/menu.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { LucideAngularModule } from 'lucide-angular';

type LeadHeaderAction = 'edit' | 'quote' | 'run-ai' | 'call' | 'email' | 'whatsapp' | 'navigate' | 'log-call' | 'send-to-org';

@Component({
  selector: 'app-lead-detail-header',
  templateUrl: './lead-detail-header.component.html',
  styleUrl: './lead-detail-header.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChipComponent, TranslatePipe, ButtonComponent, MenuComponent, PageHeaderComponent, StatusBadgeComponent, LucideAngularModule],
})
export class LeadDetailHeaderComponent {
  lead = input<Lead | null>(null);
  fullName = input<string>('');
  serviceTypeLabel = input<string | null>(null);
  hasSelectedService = input(false);
  phone = input<string | null>(null);
  email = input<string | null>(null);
  status = input<LeadStatus | null>(null);
  pipelineStage = input<PipelineStage | null>(null);
  noServiceLabel = input<string>('');
  statusMenuOpen = input(false);
  statusOptions = input<SelectOption<LeadStatus>[]>([]);
  selectedStatus = input<LeadStatus | null>(null);
  statusLabelMap = input<Partial<Record<LeadStatus, string>>>({} as Partial<Record<LeadStatus, string>>);
  energyLabelClass = input<string | null>(null);
  energyLabelVariant = input<ChipVariant>('neutral');
  canTriggerAiWorkflow = input(false);
  aiWorkflowTriggering = input(false);
  canTransfer = input(false);
  back = output<void>();
  toggleStatusMenu = output<void>();
  closeStatusMenu = output<void>();
  selectStatus = output<LeadStatus>();
  createQuote = output<void>();
  triggerAiWorkflow = output<void>();
  editLead = output<void>();
  callClicked = output<void>();
  emailClicked = output<void>();
  whatsappClicked = output<void>();
  navigateClicked = output<void>();
  logCallClicked = output<void>();
  transferClicked = output<void>();

  protected readonly desktopMenuSections = computed<readonly MenuSection[]>(() => {
    const items: MenuItem[] = [];

    items.push({ label: 'leads.detail.quickActions.navigate', value: 'navigate' });

    if (this.canTransfer()) {
      items.push({ label: 'leads.detail.actions.sendToOrg', value: 'send-to-org' });
    }

    if (this.hasSelectedService()) {
      items.push({ label: 'leads.detail.quickActions.logCall', value: 'log-call' });
    }

    return items.length ? [{ items }] : [];
  });

  protected readonly mobileMenuSections = computed<readonly MenuSection[]>(() => {
    const primaryItems: MenuItem[] = [{ label: 'leads.detail.editLead', value: 'edit' }];
    const secondaryItems: MenuItem[] = [];

    if (this.canTransfer()) {
      primaryItems.push({ label: 'leads.detail.actions.sendToOrg', value: 'send-to-org' });
    }

    if (this.hasSelectedService()) {
      primaryItems.push(
        {
          label: this.aiWorkflowTriggering() ? 'leads.detail.actions.runningAi' : 'leads.detail.actions.runAi',
          value: 'run-ai',
          disabled: !this.canTriggerAiWorkflow() || this.aiWorkflowTriggering(),
        },
        { label: 'leads.detail.createQuote', value: 'quote' },
      );
      secondaryItems.push({ label: 'leads.detail.quickActions.logCall', value: 'log-call' });
    }

    if (this.phone()) {
      secondaryItems.push({ label: 'leads.detail.quickActions.call', value: 'call' });
    }

    if (this.email()) {
      secondaryItems.push({ label: 'leads.detail.quickActions.email', value: 'email' });
    }

    if (this.phone()) {
      secondaryItems.push({ label: 'leads.detail.quickActions.whatsapp', value: 'whatsapp' });
    }

    secondaryItems.push({ label: 'leads.detail.quickActions.navigate', value: 'navigate' });

    const sections: MenuSection[] = [{ items: primaryItems }];
    if (secondaryItems.length) {
      sections.push({ items: secondaryItems });
    }

    return sections;
  });

  protected handleMenuSelection(item: MenuItem): void {
    const value = item.value as LeadHeaderAction | undefined;
    switch (value) {
      case 'edit':
        this.editLead.emit();
        break;
      case 'quote':
        this.createQuote.emit();
        break;
      case 'run-ai':
        this.triggerAiWorkflow.emit();
        break;
      case 'call':
        this.callClicked.emit();
        break;
      case 'email':
        this.emailClicked.emit();
        break;
      case 'whatsapp':
        this.whatsappClicked.emit();
        break;
      case 'navigate':
        this.navigateClicked.emit();
        break;
      case 'log-call':
        this.logCallClicked.emit();
        break;
      case 'send-to-org':
        this.transferClicked.emit();
        break;
    }
  }
}
