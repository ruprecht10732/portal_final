import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { DraftApprovalItem } from '../../../../core/services/dashboard.types';
import { DashboardDraftApprovalsService } from '../../../../core/services/dashboard-draft-approvals.service';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { CardComponent } from '../../../../shared/components/card/card.component';

@Component({
  selector: 'app-dashboard-draft-approvals',
  templateUrl: './draft-approvals.component.html',
  styleUrl: './draft-approvals.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, CardComponent, RouterLink, TranslatePipe],
})
export class DraftApprovalsComponent {
  private readonly draftApprovalsService = inject(DashboardDraftApprovalsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translateService = inject(TranslateService);

  protected readonly page = signal(1);
  protected readonly pageSize = signal(5);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly items = signal<DraftApprovalItem[]>([]);
  protected readonly total = signal(0);
  private readonly locale = signal(this.translateService.currentLang || this.translateService.getDefaultLang() || 'nl');

  protected readonly hasPrevious = computed(() => this.page() > 1);
  protected readonly hasNext = computed(() => this.page() * this.pageSize() < this.total());

  private readonly currencyFormatter = computed(() => {
    const language = this.locale();
    let locale = language;
    if (language === 'nl') {
      locale = 'nl-NL';
    } else if (language === 'en') {
      locale = 'en-US';
    }

    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'EUR',
    });
  });

  constructor() {
    this.translateService.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(event => {
        this.locale.set(event.lang);
      });

    this.loadItems();
  }

  protected previous(): void {
    if (!this.hasPrevious() || this.loading()) return;
    this.page.update(value => value - 1);
    this.loadItems();
  }

  protected next(): void {
    if (!this.hasNext() || this.loading()) return;
    this.page.update(value => value + 1);
    this.loadItems();
  }

  protected formatCurrency(cents: number): string {
    return this.currencyFormatter().format(cents / 100);
  }

  protected formatConfidence(score: number | undefined): string {
    if (typeof score !== 'number') return '—';
    return `${score}%`;
  }

  protected getConfidenceBadgeClass(score: number | undefined): string {
    const baseClass = 'inline-flex w-fit items-center justify-center border px-2 py-0.5 text-xs font-semibold';

    if (typeof score !== 'number') {
      return `${baseClass} border-zinc-300 bg-zinc-100 text-zinc-600`;
    }
    if (score >= 80) {
      return `${baseClass} border-emerald-700 bg-emerald-100 text-emerald-900`;
    }
    if (score >= 50) {
      return `${baseClass} border-amber-700 bg-amber-100 text-amber-900`;
    }
    return `${baseClass} border-red-700 bg-red-100 text-red-900`;
  }

  private loadItems(): void {
    this.loading.set(true);
    this.error.set(null);

    this.draftApprovalsService
      .getDraftApprovals(this.page(), this.pageSize())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.items.set(response.items ?? []);
          this.total.set(response.total ?? 0);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('dashboard.draftApprovals.error');
          this.loading.set(false);
        },
      });
  }
}
