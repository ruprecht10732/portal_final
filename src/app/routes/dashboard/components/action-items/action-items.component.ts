import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import type { ActionItem } from '../../../../core/services/dashboard.types';
import { DashboardActionItemsService } from '../../../../core/services/dashboard-action-items.service';

@Component({
  selector: 'app-dashboard-action-items',
  templateUrl: './action-items.component.html',
  styleUrl: './action-items.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block w-full xl:flex xl:min-h-0 xl:flex-1 xl:flex-col' },
  imports: [LucideAngularModule, DatePipe, RouterLink, TranslatePipe],
})
export class ActionItemsComponent {
  private readonly actionItemsService = inject(DashboardActionItemsService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly page = signal(1);
  protected readonly pageSize = signal(5);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly items = signal<ActionItem[]>([]);
  protected readonly total = signal(0);

  protected readonly hasPrevious = computed(() => this.page() > 1);
  protected readonly hasNext = computed(() => this.page() * this.pageSize() < this.total());

  constructor() {
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

  private loadItems(): void {
    this.loading.set(true);
    this.error.set(null);

    this.actionItemsService
      .getActionItems(this.page(), this.pageSize())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.items.set(response.items ?? []);
          this.total.set(response.total ?? 0);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('dashboard.actionItems.error');
          this.loading.set(false);
        },
      });
  }
}
