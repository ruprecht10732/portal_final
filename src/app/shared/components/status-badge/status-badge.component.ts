 
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { merge } from 'rxjs';
import { buildLeadStatusLabels, buildPipelineStageLabels, PIPELINE_STAGE_COLORS, STATUS_COLORS, type LeadStatus, type PipelineStage } from '../../../core/services/leads.types';

type StatusBadgeType = 'lead' | 'pipeline';

type StatusBadgeSize = 'sm' | 'md';

@Component({
  selector: 'shared-status-badge',
  templateUrl: './status-badge.component.html',
  styleUrl: './status-badge.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusBadgeComponent {
  private readonly translate = inject(TranslateService);
  private readonly lang = toSignal(
    merge(this.translate.onLangChange, this.translate.onTranslationChange),
    {
    initialValue: { lang: 'en', translations: {} },
    }
  );

  status = input<unknown>(null);
  type = input<StatusBadgeType>('lead');
  size = input<StatusBadgeSize>('sm');
  emptyLabel = input<string>('-');

  protected readonly statusLabels = computed<Record<LeadStatus, string>>(() => {
    this.lang();
    if (this.type() !== 'lead') {
      return {} as Record<LeadStatus, string>;
    }
    return buildLeadStatusLabels((key) => this.translate.instant(key));
  });

  protected readonly pipelineLabels = computed<Record<PipelineStage, string>>(() => {
    this.lang();
    return buildPipelineStageLabels((key) => this.translate.instant(key));
  });

  protected readonly label = computed(() => {
    const status = this.status();
    if (status === null || status === undefined || status === '') {
      return this.emptyLabel();
    }
    if (this.type() === 'lead' && this.isLeadStatus(status)) {
      return this.statusLabels()[status] ?? String(status);
    }
    if (this.isPipelineStage(status)) {
      return this.pipelineLabels()[status] ?? String(status);
    }
    return this.formatStatusValue(status);
  });

  protected readonly badgeClass = computed(() => {
    const sizeClass = this.size() === 'md' ? 'text-sm px-4 py-2' : 'text-xs px-2.5 py-1';
    const baseClass = `inline-flex items-center rounded-full font-semibold ${sizeClass}`;
    const status = this.status();

    if (this.type() === 'lead' && this.isLeadStatus(status)) {
      return `${baseClass} ${STATUS_COLORS[status] ?? 'bg-zinc-100 text-zinc-600'}`;
    }

    if (this.isPipelineStage(status)) {
      return `${baseClass} ${PIPELINE_STAGE_COLORS[status] ?? 'bg-zinc-100 text-zinc-600'}`;
    }

    return `${baseClass} bg-zinc-100 text-zinc-600`;
  });

  private isLeadStatus(status: unknown): status is LeadStatus {
    return typeof status === 'string' && status in STATUS_COLORS;
  }

  private isPipelineStage(status: unknown): status is PipelineStage {
    return typeof status === 'string' && status in PIPELINE_STAGE_COLORS;
  }

  private formatStatusValue(status: unknown): string {
    if (typeof status === 'string' || typeof status === 'number' || typeof status === 'boolean') {
      return String(status);
    }
    if (status instanceof Date) {
      return status.toISOString();
    }
    if (typeof status === 'object' && status !== null) {
      try {
        const value = JSON.stringify(status);
        return value === '{}' ? this.emptyLabel() : value;
      } catch {
        return this.emptyLabel();
      }
    }
    return this.emptyLabel();
  }
}
