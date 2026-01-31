/**
 * Data Grid Pagination Component
 * Provides pagination controls with deep linking support
 */

import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { PaginationConfig } from './data-grid.types';
import { SelectComponent, SelectOption } from '../select/select.component';

@Component({
  selector: 'data-grid-pagination',
  imports: [FormsModule, SelectComponent, TranslatePipe],
  templateUrl: './data-grid-pagination.component.html',
  styleUrl: './data-grid-pagination.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataGridPaginationComponent {
  private readonly translate = inject(TranslateService);
  private readonly lang = toSignal(this.translate.onLangChange, {
    initialValue: { lang: 'en', translations: {} },
  });
  // ============ Inputs ============
  
  readonly pagination = input.required<PaginationConfig>();
  readonly totalPages = input.required<number>();
  readonly pageNumbers = input<number[]>([]);

  // ============ Outputs ============
  
  readonly pageChange = output<number>();
  readonly pageSizeChange = output<number>();

  // ============ Methods ============
  
  protected onPageChange(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.pageChange.emit(page);
  }

  protected onPageSizeValueChange(value: unknown): void {
    const size = Number(value);
    if (!Number.isNaN(size)) {
      this.pageSizeChange.emit(size);
    }
  }

  protected pageSizeOptions(): SelectOption<number>[] {
    this.lang();
    return this.pagination().pageSizeOptions.map(size => ({
      label: this.translate.instant('dataGrid.perPage', { count: size }),
      value: size,
    }));
  }

  protected get startItem(): number {
    const { page, pageSize } = this.pagination();
    return (page - 1) * pageSize + 1;
  }

  protected get endItem(): number {
    const { page, pageSize, totalItems } = this.pagination();
    return Math.min(page * pageSize, totalItems);
  }

  protected getPageAriaLabel(page: number): string {
    this.lang();
    if (page === this.pagination().page) {
      return this.translate.instant('dataGrid.pageCurrent', { page });
    }
    return this.translate.instant('dataGrid.goToPage', { page });
  }
}
