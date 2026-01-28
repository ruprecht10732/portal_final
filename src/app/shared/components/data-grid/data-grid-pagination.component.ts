/**
 * Data Grid Pagination Component
 * Provides pagination controls with deep linking support
 */

import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PaginationConfig } from './data-grid.types';
import { SelectComponent, SelectOption } from '../select/select.component';

@Component({
  selector: 'data-grid-pagination',
  imports: [FormsModule, SelectComponent],
  templateUrl: './data-grid-pagination.component.html',
  styleUrl: './data-grid-pagination.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataGridPaginationComponent {
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
    return this.pagination().pageSizeOptions.map(size => ({
      label: `${size} / page`,
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
    if (page === this.pagination().page) {
      return `Page ${page}, current page`;
    }
    return `Go to page ${page}`;
  }
}
