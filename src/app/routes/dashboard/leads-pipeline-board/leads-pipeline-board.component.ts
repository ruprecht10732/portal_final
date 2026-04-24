import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { formatFullName, loadAllPages } from '../dashboard.utils';
import {
  PIPELINE_STAGE_COLORS,
  PIPELINE_STAGE_I18N_KEYS,
  Lead,
  PipelineStage,
} from '../../../core/services/leads.types';
import { LeadsService } from '../../../core/services/leads.service';
import { ToastService } from '../../../core/services/toast.service';
import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';

const PAGE_SIZE = 100;
const MAX_AUTO_PAGES = 10;

const PIPELINE_ORDER: PipelineStage[] = [
  'Triage',
  'Nurturing',
  'Estimation',
  'Proposal',
  'Fulfillment',
  'Manual_Intervention',
  'Completed',
  'Lost',
];

@Component({
  selector: 'app-leads-pipeline-board',
  imports: [TranslatePipe, RouterLink, DatePipe, PageLayoutComponent],
  templateUrl: './leads-pipeline-board.component.html',
  styleUrl: './leads-pipeline-board.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'xl:flex xl:flex-col xl:flex-1 xl:min-h-0 xl:overflow-y-auto' },
})
export class LeadsPipelineBoardComponent {
  private readonly leadsService = inject(LeadsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);

  protected readonly loading = signal(true);
  protected readonly items = signal<Lead[]>([]);

  protected readonly columns = computed(() => {
    const grouped = new Map<PipelineStage, Lead[]>();

    for (const stage of PIPELINE_ORDER) {
      grouped.set(stage, []);
    }

    for (const lead of this.items()) {
      const stage = this.resolvePipelineStage(lead);
      grouped.get(stage)?.push(lead);
    }

    return PIPELINE_ORDER.map(stage => ({
      stage,
      titleKey: PIPELINE_STAGE_I18N_KEYS[stage],
      colorClass: PIPELINE_STAGE_COLORS[stage],
      items: grouped.get(stage) ?? [],
    }));
  });

  constructor() {
    this.load();
  }

  protected trackLead(index: number, lead: Lead): string {
    return lead.id || `${index}`;
  }

  protected getLeadName(lead: Lead): string {
    return formatFullName(lead.consumer.firstName, lead.consumer.lastName);
  }

  private load(): void {
    this.loading.set(true);
    loadAllPages(params => this.leadsService.list(params), PAGE_SIZE, MAX_AUTO_PAGES)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          this.items.set(result.items);
          if (result.truncated) {
            this.toast.warning(this.translate.instant('dashboard.boards.partialDataWarning', { maxItems: PAGE_SIZE * MAX_AUTO_PAGES }));
          }
          this.loading.set(false);
        },
        error: () => {
          this.items.set([]);
          this.loading.set(false);
        },
      });
  }

  private resolvePipelineStage(lead: Lead): PipelineStage {
    if (lead.currentService?.pipelineStage) {
      return lead.currentService.pipelineStage;
    }

    return 'Triage';
  }
}