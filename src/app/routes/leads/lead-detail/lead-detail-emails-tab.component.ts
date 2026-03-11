import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { LeadLinkedEmailMessage } from '../../../core/services/leads.types';

@Component({
  selector: 'app-lead-detail-emails-tab',
  templateUrl: './lead-detail-emails-tab.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
})
export class LeadDetailEmailsTabComponent {
  emails = input<LeadLinkedEmailMessage[]>([]);
  loading = input<boolean>(false);
  error = input<string | null>(null);
  formatHumanDateTime = input<(value: string | undefined | null) => string>((value) => value ?? '-');

  openEmail = output<LeadLinkedEmailMessage>();

  protected readonly trackByEmail = (_index: number, email: LeadLinkedEmailMessage): string => `${email.accountId}:${email.messageUid}`;

  protected emailSubject(email: LeadLinkedEmailMessage): string {
    const subject = email.subject?.trim();
    return subject && subject.length > 0 ? subject : 'leads.detail.timeline.noSubject';
  }

  protected emailSender(email: LeadLinkedEmailMessage): string {
    const name = email.fromName?.trim();
    const address = email.fromAddress?.trim();
    return name || address || '-';
  }

  protected emailTimestamp(email: LeadLinkedEmailMessage): string {
    return email.receivedAt ?? email.sentAt ?? email.relationshipUpdatedAt;
  }
}