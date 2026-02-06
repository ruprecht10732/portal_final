import { ChangeDetectionStrategy, Component, input, output, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import type { LeadTimelineItem } from '../../../core/services/leads.types';
import { ButtonComponent } from '../../../shared/components/button/button.component';

@Component({
  selector: 'app-lead-detail-timeline-tab',
  templateUrl: './lead-detail-timeline-tab.component.html',
  styleUrl: './lead-detail-timeline-tab.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent],
})
export class LeadDetailTimelineTabComponent {
  private readonly translate = inject(TranslateService);

  timelineItems = input<LeadTimelineItem[]>([]);
  timelineLoading = input<boolean>(false);
  timelineError = input<string | null>(null);
  copiedContactMessage = input<string | null>(null);
  leadPhone = input<string>('');
  leadEmail = input<string | null>(null);

  formatHumanDateTime = input<(value: string | undefined) => string>((value) => value ?? '-');
  getTimelineTypeLabel = input<(type: LeadTimelineItem['type']) => string>(String);
  getTimelineTypeBadgeClass = input<(type: LeadTimelineItem['type']) => string>(() => '');
  getTimelinePartnerSummary = input<(item: LeadTimelineItem) => string | null>(() => null);
  getTimelineEstimation = input<(item: LeadTimelineItem) => { priceRange?: string; scope?: string; notes?: string } | null>(() => null);
  getTimelineRecommendedAction = input<(item: LeadTimelineItem) => string | null>(() => null);
  getTimelineContactMessage = input<(item: LeadTimelineItem) => { channel: 'WhatsApp' | 'Email'; message: string } | null>(() => null);
  getTimelineMissingInformation = input<(item: LeadTimelineItem) => string[]>(() => []);
  getTimelineScore = input<(item: LeadTimelineItem) => { score: number; preAi?: number; version?: string } | null>(() => null);

  openCallLogger = output<void>();
  openWhatsApp = output<{ phone: string; message: string }>();
  composeEmail = output<{ email: string | undefined; message: string }>();
  copyContactMessage = output<{ itemId: string; message: string }>();

  protected formatEstimationNotes(value: string): string {
    const escaped = this.escapeHtml(value);
    const bolded = escaped.replaceAll(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    return bolded.replaceAll(/\r?\n/g, '<br />');
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
  }

  protected t(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params);
  }
}
