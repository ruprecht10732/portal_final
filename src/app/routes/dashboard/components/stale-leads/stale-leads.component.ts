import { Clipboard } from '@angular/cdk/clipboard';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { catchError, EMPTY, finalize } from 'rxjs';
import { StaleLeadsService, type StaleLeadItem } from '../../../../core/services/stale-leads.service';

@Component({
  selector: 'app-dashboard-stale-leads',
  imports: [TranslatePipe, DatePipe],
  templateUrl: './stale-leads.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-h-0 flex-1 overflow-y-auto' },
})
export class StaleLeadsComponent {
  private readonly staleLeadsService = inject(StaleLeadsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  private readonly clipboard = inject(Clipboard);

  protected readonly items = signal<StaleLeadItem[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly hasError = signal(false);
  protected readonly expandedDraft = signal<string | null>(null);
  protected readonly copiedId = signal<string | null>(null);

  constructor() {
    this.load();
  }

  private load(): void {
    this.isLoading.set(true);
    this.hasError.set(false);

    this.staleLeadsService
      .list(10)
      .pipe(
        catchError(() => {
          this.hasError.set(true);
          return EMPTY;
        }),
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(res => this.items.set(res.items));
  }

  protected navigateToLead(leadId: string): void {
    void this.router.navigate(['/app/leads', leadId]);
  }

  protected toggleDraft(serviceId: string, event: MouseEvent): void {
    event.stopPropagation();
    this.expandedDraft.update(cur => (cur === serviceId ? null : serviceId));
  }

  protected copyDraft(serviceId: string, message: string, event: MouseEvent): void {
    event.stopPropagation();
    this.clipboard.copy(message);
    this.copiedId.set(serviceId);
    setTimeout(() => this.copiedId.set(null), 2000);
  }

  private readonly channelBadgeMap: Record<string, string> = {
    whatsapp: 'bg-green-50 text-green-700 ring-green-600/10',
    email: 'bg-sky-50 text-sky-700 ring-sky-600/10',
    phone: 'bg-violet-50 text-violet-700 ring-violet-600/10',
  };

  protected channelBadgeClass(channel: string | undefined): string {
    return this.channelBadgeMap[channel ?? ''] ?? 'bg-zinc-50 text-zinc-700 ring-zinc-600/10';
  }

  private readonly reasonBadgeMap: Record<string, string> = {
    no_activity: 'bg-red-50 text-red-700 ring-red-600/10',
    stuck_nurturing: 'bg-amber-50 text-amber-700 ring-amber-600/10',
    no_quote_sent: 'bg-orange-50 text-orange-700 ring-orange-600/10',
    stale_draft: 'bg-blue-50 text-blue-700 ring-blue-600/10',
    needs_rescheduling: 'bg-purple-50 text-purple-700 ring-purple-600/10',
  };

  protected reasonBadgeClass(reason: string): string {
    return this.reasonBadgeMap[reason] ?? 'bg-zinc-50 text-zinc-700 ring-zinc-600/10';
  }
}
