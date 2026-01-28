/**
 * Data Grid Header Component
 * Renders column headers with sort controls
 */

import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';
import { GridColumn, SortConfig } from './data-grid.types';

@Component({
  selector: 'data-grid-header',
  templateUrl: './data-grid-header.component.html',
  styleUrl: './data-grid-header.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'role': 'rowgroup',
  },
})
export class DataGridHeaderComponent<T = unknown> {
  // ============ Inputs ============
  
  readonly columns = input<GridColumn<T>[]>([]);
  readonly sort = input<SortConfig | null>(null);
  readonly allSelected = input<boolean>(false);
  readonly partiallySelected = input<boolean>(false);
  readonly selectable = input<boolean>(true);

  // ============ Outputs ============
  
  readonly sortChange = output<string>();
  readonly selectAll = output<void>();

  // ============ View Children ============
  
  private readonly headerCheckbox = viewChild<ElementRef<HTMLInputElement>>('headerCheckbox');

  // ============ Methods ============
  
  protected onSort(column: GridColumn<T>): void {
    if (!column.sortable) return;
    this.sortChange.emit(column.id);
  }

  protected onSelectAll(): void {
    this.selectAll.emit();
  }

  protected getSortDirection(columnId: string): 'asc' | 'desc' | null {
    const currentSort = this.sort();
    if (!currentSort?.columnId || currentSort.columnId !== columnId) return null;
    return currentSort.direction;
  }

  protected getSortAriaLabel(column: GridColumn<T>): string {
    if (!column.sortable) return column.header;
    
    const direction = this.getSortDirection(column.id);
    if (direction === 'asc') {
      return `${column.header}, sorted ascending, click to sort descending`;
    } else if (direction === 'desc') {
      return `${column.header}, sorted descending, click to clear sort`;
    }
    return `${column.header}, click to sort ascending`;
  }

  /** Calculate left position for frozen columns */
  protected getFrozenColumnLeft(columnIndex: number): string {
    const cols = this.columns();
    let left = this.selectable() ? 48 : 0; // checkbox column width
    
    for (let i = 0; i < columnIndex; i++) {
      if (cols[i]?.frozen) {
        // Use minWidth or default
        const width = cols[i].minWidth ?? cols[i].width ?? '150px';
        left += Number.parseInt(width, 10) || 150;
      }
    }
    
    return `${left}px`;
  }
}
