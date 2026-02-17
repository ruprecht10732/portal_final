import { DatePipe } from '@angular/common';
import { CdkDrag, CdkDragDrop, CdkDropList, DragDropModule } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { EMPTY, Observable, expand, map, reduce } from 'rxjs';
import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';
import {
  LEAD_STATUS_I18N_KEYS,
  STATUS_COLORS,
  Lead,
  LeadStatus,
} from '../../../core/services/leads.types';
import { LeadsService } from '../../../core/services/leads.service';
import { ToastService } from '../../../core/services/toast.service';

const PAGE_SIZE = 200;
const MAX_AUTO_PAGES = 10;

const STATUS_ORDER: LeadStatus[] = [
  'New',
  'Attempted_Contact',
  'Appointment_Scheduled',
  'Survey_Completed',
  'Quote_Draft',
  'Quote_Sent',
  'Quote_Accepted',
  'Partner_Assigned',
  'Needs_Rescheduling',
  'Completed',
  'Lost',
  'Disqualified',
];

const ALLOWED_STATUS_TRANSITIONS: Record<LeadStatus, readonly LeadStatus[]> = {
  New: ['Attempted_Contact', 'Appointment_Scheduled', 'Lost', 'Disqualified'],
  Attempted_Contact: ['Appointment_Scheduled', 'Needs_Rescheduling', 'Lost', 'Disqualified'],
  Appointment_Scheduled: ['Survey_Completed', 'Needs_Rescheduling', 'Lost', 'Disqualified'],
  Survey_Completed: ['Quote_Draft', 'Needs_Rescheduling', 'Lost', 'Disqualified'],
  Quote_Draft: ['Quote_Sent', 'Lost', 'Disqualified'],
  Quote_Sent: ['Quote_Accepted', 'Lost', 'Disqualified'],
  Quote_Accepted: ['Partner_Assigned', 'Completed'],
  Partner_Assigned: ['Completed', 'Needs_Rescheduling'],
  Needs_Rescheduling: ['Appointment_Scheduled', 'Lost', 'Disqualified'],
  Completed: [],
  Lost: [],
  Disqualified: [],
};

@Component({
  selector: 'app-leads-status-board',
  imports: [TranslatePipe, RouterLink, DatePipe, DragDropModule, PageLayoutComponent],
  templateUrl: './leads-status-board.component.html',
  styleUrl: './leads-status-board.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeadsStatusBoardComponent {
  private readonly leadsService = inject(LeadsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);

  protected readonly loading = signal(true);
  protected readonly items = signal<Lead[]>([]);
  protected readonly savingLeadIds = signal<Set<string>>(new Set());
  protected readonly draggingFromStatus = signal<LeadStatus | null>(null);

  protected readonly columns = computed(() => {
    const grouped = new Map<LeadStatus, Lead[]>();

    for (const status of STATUS_ORDER) {
      grouped.set(status, []);
    }

    for (const lead of this.items()) {
      const status = this.resolveLeadStatus(lead);
      grouped.get(status)?.push(lead);
    }

    return STATUS_ORDER.map(status => ({
      status,
      titleKey: LEAD_STATUS_I18N_KEYS[status],
      colorClass: STATUS_COLORS[status],
      items: grouped.get(status) ?? [],
    }));
  });

  constructor() {
    this.load();
  }

  protected readonly canEnterColumn = (drag: CdkDrag<Lead>, drop: CdkDropList<Lead[]>): boolean => {
    const lead = drag.data;
    if (!lead) {
      return false;
    }

    const fromStatus = this.resolveLeadStatus(lead);
    const toStatus = this.parseDropStatus(drop.id);
    if (!toStatus) {
      return false;
    }

    return fromStatus === toStatus || this.isTransitionAllowed(fromStatus, toStatus);
  };

  protected onDrop(event: CdkDragDrop<Lead[]>): void {
    const lead = event.item.data;
    if (!lead) {
      return;
    }

    const fromStatus = this.resolveLeadStatus(lead);
    const toStatus = this.parseDropStatus(event.container.id);
    if (!toStatus || fromStatus === toStatus || !this.isTransitionAllowed(fromStatus, toStatus)) {
      return;
    }

    this.updateLeadStatus(lead, toStatus);
  }

  protected onDragStarted(lead: Lead): void {
    this.draggingFromStatus.set(this.resolveLeadStatus(lead));
  }

  protected onDragEnded(): void {
    this.draggingFromStatus.set(null);
  }

  protected connectedDropListIds(currentStatus: LeadStatus): string[] {
    return STATUS_ORDER.filter(status => status !== currentStatus).map(status => this.statusDropListId(status));
  }

  protected isColumnDimmed(status: LeadStatus): boolean {
    const draggingFromStatus = this.draggingFromStatus();
    if (!draggingFromStatus) {
      return false;
    }

    if (draggingFromStatus === status) {
      return false;
    }

    return !this.isTransitionAllowed(draggingFromStatus, status);
  }

  protected statusDropListId(status: LeadStatus): string {
    return `lead-status-${status}`;
  }

  protected isSavingLead(leadId: string): boolean {
    return this.savingLeadIds().has(leadId);
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

  private updateLeadStatus(lead: Lead, toStatus: LeadStatus): void {
    const leadId = lead.id;
    if (!leadId || this.savingLeadIds().has(leadId)) {
      return;
    }

    const previousItems = this.items();
    this.savingLeadIds.update(current => new Set([...current, leadId]));

    this.items.set(
      previousItems.map(item => {
        if (item.id !== leadId) {
          return item;
        }

        if (!item.currentService) {
          return { ...item, aggregateStatus: toStatus };
        }

        return {
          ...item,
          aggregateStatus: toStatus,
          currentService: {
            ...item.currentService,
            status: toStatus,
          },
        };
      }),
    );

    this.leadsService
      .updateStatus(leadId, { status: toStatus })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: updatedLead => {
          this.items.update(current => current.map(item => (item.id === updatedLead.id ? updatedLead : item)));
          this.savingLeadIds.update(current => {
            const next = new Set(current);
            next.delete(leadId);
            return next;
          });
        },
        error: () => {
          this.items.set(previousItems);
          this.savingLeadIds.update(current => {
            const next = new Set(current);
            next.delete(leadId);
            return next;
          });
        },
      });
  }

  private isTransitionAllowed(fromStatus: LeadStatus, toStatus: LeadStatus): boolean {
    return ALLOWED_STATUS_TRANSITIONS[fromStatus].includes(toStatus);
  }

  private parseDropStatus(dropId: string): LeadStatus | null {
    const prefix = 'lead-status-';
    if (!dropId.startsWith(prefix)) {
      return null;
    }

    const rawStatus = dropId.slice(prefix.length) as LeadStatus;
    return STATUS_ORDER.includes(rawStatus) ? rawStatus : null;
  }

  private resolveLeadStatus(lead: Lead): LeadStatus {
    if (lead.currentService?.status) {
      return lead.currentService.status;
    }

    if (lead.aggregateStatus) {
      return lead.aggregateStatus;
    }

    return 'New';
  }
}