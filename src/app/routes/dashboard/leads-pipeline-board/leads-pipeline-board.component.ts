import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { EMPTY, Observable, expand, map, reduce } from 'rxjs';
import {
  PIPELINE_STAGE_COLORS,
  PIPELINE_STAGE_I18N_KEYS,
  Lead,
  PipelineStage,
} from '../../../core/services/leads.types';
import { LeadsService } from '../../../core/services/leads.service';
import { ToastService } from '../../../core/services/toast.service';
import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';

const PAGE_SIZE = 200;
const MAX_AUTO_PAGES = 10;

const PIPELINE_ORDER: PipelineStage[] = [
  'Triage',
  'Nurturing',
  'Ready_For_Estimator',
  'Quote_Draft',
  'Quote_Sent',
  'Ready_For_Partner',
  'Partner_Matching',
  'Partner_Assigned',
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
    const firstName = lead.consumer.firstName?.trim() ?? '';
    const lastName = lead.consumer.lastName?.trim() ?? '';
    return `${firstName} ${lastName}`.trim() || '—';
  }

  private load(): void {
    this.loading.set(true);
    this.loadAllLeads()
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

  private loadAllLeads(pageSize = PAGE_SIZE, maxPages = MAX_AUTO_PAGES): Observable<{ items: Lead[]; truncated: boolean }> {
    return this.leadsService.list({ page: 1, pageSize }).pipe(
      expand(response =>
        response.page < response.totalPages && response.page < maxPages
          ? this.leadsService.list({ page: response.page + 1, pageSize })
          : EMPTY,
      ),
      reduce(
        (acc, response) => ({
          items: [...acc.items, ...(response.items ?? [])],
          lastPage: response.page,
          totalPages: response.totalPages,
        }),
        { items: [] as Lead[], lastPage: 0, totalPages: 0 },
      ),
      map(acc => ({
        items: acc.items,
        truncated: acc.lastPage < acc.totalPages,
      })),
    );
  }

  private resolvePipelineStage(lead: Lead): PipelineStage {
    if (lead.currentService?.pipelineStage) {
      return lead.currentService.pipelineStage;
    }

    return 'Triage';
  }
}