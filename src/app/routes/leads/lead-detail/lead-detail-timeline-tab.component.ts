import { ChangeDetectionStrategy, Component, input, output, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import type { LeadTimelineItem, PipelineStage, TimelinePhotoAnalysisSummary } from '../../../core/services/leads.types';
import { PIPELINE_STAGE_I18N_KEYS } from '../../../core/services/leads.types';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { PhoneFormatPipe } from '../../../shared/pipes/phone-format.pipe';

@Component({
  selector: 'app-lead-detail-timeline-tab',
  templateUrl: './lead-detail-timeline-tab.component.html',
  styleUrl: './lead-detail-timeline-tab.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, PhoneFormatPipe],
})
export class LeadDetailTimelineTabComponent {
  private readonly translate = inject(TranslateService);

  timelineItems = input<LeadTimelineItem[]>([]);
  timelineLoading = input<boolean>(false);
  timelineError = input<string | null>(null);
  copiedContactMessage = input<string | null>(null);
  sendingWhatsAppItemId = input<string | null>(null);
  leadPhone = input<string>('');
  leadEmail = input<string | null>(null);
  approvingAppointmentId = input<string | null>(null);

  formatHumanDateTime = input<(value: string | undefined) => string>((value) => value ?? '-');
  getTimelineTypeLabel = input<(type: LeadTimelineItem['type']) => string>(String);
  getTimelineTypeBadgeClass = input<(type: LeadTimelineItem['type']) => string>(() => '');
  getTimelinePartnerSummary = input<(item: LeadTimelineItem) => string | null>(() => null);
  getTimelineEstimation = input<(item: LeadTimelineItem) => { priceRange?: string; scope?: string; notes?: string } | null>(() => null);
  getTimelineRecommendedAction = input<(item: LeadTimelineItem) => string | null>(() => null);
  getTimelineContactMessage = input<(item: LeadTimelineItem) => { itemId: string; channel: 'WhatsApp' | 'Email'; message: string; status?: 'sent' | 'draft' | 'failed'; phone?: string; canSend?: boolean } | null>(() => null);
  getTimelineMissingInformation = input<(item: LeadTimelineItem) => string[]>(() => []);
  getTimelineResolvedInformation = input<(item: LeadTimelineItem) => string[]>(() => []);
  getTimelineExtractedFacts = input<(item: LeadTimelineItem) => { key: string; value: string }[]>(() => []);
  getTimelineScore = input<(item: LeadTimelineItem) => { score: number; preAi?: number; version?: string } | null>(() => null);
  getTimelineDraftedQuote = input<(item: LeadTimelineItem) => { quoteId: string; quoteNumber: string; itemCount: number; catalogItems: number; adHocItems: number } | null>(() => null);
  getTimelineAppointmentApproval = input<(item: LeadTimelineItem) => { appointmentId: string } | null>(() => null);
  getTimelinePhotoAnalysis = input<(item: LeadTimelineItem) => TimelinePhotoAnalysisSummary | null>(() => null);

  openCallLogger = output<void>();
  sendWhatsApp = output<{ itemId: string }>();
  composeEmail = output<{ email: string | undefined; message: string }>();
  copyContactMessage = output<{ itemId: string; message: string }>();
  viewDraftQuote = output<string>();
  approveAppointment = output<string>();

  protected getStageTitle(item: LeadTimelineItem): string {
    const oldStage = item.metadata['oldStage'] as PipelineStage | undefined;
    const newStage = item.metadata['newStage'] as PipelineStage | undefined;
    if (oldStage && newStage) {
      const oldLabel = PIPELINE_STAGE_I18N_KEYS[oldStage]
        ? this.translate.instant(PIPELINE_STAGE_I18N_KEYS[oldStage])
        : oldStage;
      const newLabel = PIPELINE_STAGE_I18N_KEYS[newStage]
        ? this.translate.instant(PIPELINE_STAGE_I18N_KEYS[newStage])
        : newStage;
      return `${oldLabel} → ${newLabel}`;
    }
    return item.title || this.t('leads.detail.timeline.stageUpdated');
  }

  protected formatEstimationNotes(value: string): string {
    const escaped = this.escapeHtml(value);
    const bolded = escaped.replaceAll(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    return bolded.replaceAll(/\r?\n/g, '<br />');
  }

  protected getFactLabel(key: string): string {
    const translationKey = `leads.detail.timeline.factLabels.${key}`;
    const translated = this.translate.instant(translationKey);
    if (translated !== translationKey) {
      return translated;
    }
    return key
      .split('_')
      .filter((segment) => segment.trim() !== '')
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' ');
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
