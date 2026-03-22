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

  protected readonly items = signal<StaleLeadItem[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly hasError = signal(false);

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
    this.router.navigate(['/leads', leadId]);
  }

  protected reasonBadgeClass(reason: string): string {
    switch (reason) {
      case 'no_activity':
        return 'bg-red-50 text-red-700 ring-red-600/10';
      case 'stuck_nurturing':
        return 'bg-amber-50 text-amber-700 ring-amber-600/10';
      case 'no_quote_sent':
        return 'bg-orange-50 text-orange-700 ring-orange-600/10';
      case 'stale_draft':
        return 'bg-blue-50 text-blue-700 ring-blue-600/10';
      case 'needs_rescheduling':
        return 'bg-purple-50 text-purple-700 ring-purple-600/10';
      default:
        return 'bg-zinc-50 text-zinc-700 ring-zinc-600/10';
    }
  }
}
