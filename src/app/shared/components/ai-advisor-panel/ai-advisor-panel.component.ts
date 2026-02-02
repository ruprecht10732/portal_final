/* eslint-disable @angular-eslint/component-selector */
import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { DatePipe, NgClass } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import type { LeadAIAnalysis, LeadStatus, PreferredContactChannel, UrgencyLevel } from '../../../core/services/leads.types';
import { ButtonComponent } from '../button/button.component';

const TERMINAL_STATUSES = new Set<LeadStatus>(['Closed', 'Bad_Lead', 'Surveyed']);

@Component({
  selector: 'shared-ai-advisor-panel',
  templateUrl: './ai-advisor-panel.component.html',
  styleUrl: './ai-advisor-panel.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass, DatePipe, ButtonComponent, TranslatePipe],
  host: {
    '[class]': "'block w-full'",
  },
})
export class AiAdvisorPanelComponent {
  analysis = input<LeadAIAnalysis | null>(null);
  loading = input<boolean>(false);
  error = input<string | null>(null);
  refreshing = input<boolean>(false);
  isDefault = input<boolean>(false);
  noNewInfo = input<boolean>(false);
  serviceStatus = input<LeadStatus | null>(null);
  consumerPhone = input<string | null>(null);
  consumerEmail = input<string | null>(null);

  refresh = output<void>();
  forceRefresh = output<void>();

  editableMessage = signal<string>('');
  copied = signal<boolean>(false);

  constructor() {
    effect(() => {
      const analysis = this.analysis();
      if (analysis?.suggestedContactMessage) {
        this.editableMessage.set(analysis.suggestedContactMessage);
      } else {
        this.editableMessage.set('');
      }
    });
  }

  canRefresh = computed(() => {
    const status = this.serviceStatus();
    if (!status) return true;
    return !TERMINAL_STATUSES.has(status);
  });

  isStale(): boolean {
    const a = this.analysis();
    if (!a?.createdAt) return false;
    const createdAt = new Date(a.createdAt);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return createdAt < sevenDaysAgo;
  }

  getUrgencyColor(level: UrgencyLevel): string {
    switch (level) {
      case 'High':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'Medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-zinc-100 text-zinc-800 border-zinc-200';
    }
  }

  getUrgencyLabel(level: UrgencyLevel): string {
    return level;
  }

  copyMessage(): void {
    const text = this.editableMessage();
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    });
  }

  protected readonly encodeURIComponent = encodeURIComponent;

  getWhatsAppUrl(phone: string | null | undefined, message: string | null | undefined): string {
    if (!phone || !message) return '';
    // Basic sanitization: remove non-digits
    const cleanPhone = phone.replaceAll(/\D/g, '');
    const encodedMessage = encodeURIComponent(message);
    return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
  }

  getEmailUrl(email: string | null | undefined, message: string | null | undefined): string {
    if (!email || !message) return '';
    const subject = encodeURIComponent('Lead opvolging');
    const body = encodeURIComponent(message);
    return `mailto:${email}?subject=${subject}&body=${body}`;
  }

  getChannelLabel(channel: PreferredContactChannel | null | undefined): string {
    return channel === 'Email' ? 'Email' : 'WhatsApp';
  }
}
