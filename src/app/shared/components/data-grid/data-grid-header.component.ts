/**
 * Data Grid Header Component
 * Renders column headers with sort controls and resize handles
 */

import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { GridColumn, SortConfig } from './data-grid.types';
import { CheckboxComponent } from '../checkbox/checkbox.component';

@Component({
  selector: '[data-grid-header]',
  templateUrl: './data-grid-header.component.html',
  styleUrl: './data-grid-header.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CheckboxComponent, TranslatePipe],
  host: {
    'role': 'row',
  },
})
export class DataGridHeaderComponent<T = unknown> {
  private readonly translate = inject(TranslateService);
  private readonly lang = toSignal(this.translate.onLangChange, {
    initialValue: { lang: 'en', translations: {} },
  });
  // ============ Inputs ============
  
  readonly columns = input<GridColumn<T>[]>([]);
  readonly sort = input<SortConfig | null>(null);
  readonly allSelected = input<boolean>(false);
  readonly partiallySelected = input<boolean>(false);
  readonly selectable = input<boolean>(true);

  // ============ Outputs ============
  
  readonly sortChange = output<string>();
  readonly selectAll = output<void>();
  readonly columnResize = output<{ columnId: string; width: number }>();

  // ============ Resize State ============
  
  private readonly resizing = signal(false);
  private readonly resizeColumnIndex = signal<number | null>(null);
  private startX = 0;
  private startWidth = 0;
  private currentTh: HTMLElement | null = null;

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
    this.lang();
    const direction = this.getSortDirection(column.id);
    if (direction === 'asc') {
      return this.translate.instant('dataGrid.sortAscending', { column: column.header });
    } else if (direction === 'desc') {
      return this.translate.instant('dataGrid.sortDescending', { column: column.header });
    }
    return this.translate.instant('dataGrid.sortNone', { column: column.header });
  }

  protected getAriaColIndex(columnIndex: number): number {
    return columnIndex + 1 + (this.selectable() ? 1 : 0);
  }

  /** Calculate left position for frozen columns */
  protected getFrozenColumnLeft(columnIndex: number): string {
    return `${this.getFrozenOffset(columnIndex)}px`;
  }

  private getFrozenOffset(columnIndex: number): number {
    const cols = this.columns();
    const base = this.selectable() ? 40 : 0;
    return base + this.sumFrozenWidths(cols, columnIndex);
  }

  private sumFrozenWidths(cols: GridColumn<T>[], columnIndex: number): number {
    let total = 0;

    for (let i = 0; i < columnIndex; i++) {
      const col = cols[i];
      if (!col?.frozen) continue;
      const width = col.minWidth ?? col.width ?? '150px';
      total += this.parseColumnWidth(width);
    }

    return total;
  }

  private parseColumnWidth(value: string | number): number {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const parsed = Number.parseInt(String(value), 10);
    return Number.isFinite(parsed) ? parsed : 150;
  }

  // ============ Resize Handlers ============

  protected onResizeStart(event: MouseEvent | TouchEvent, colIndex: number, thElement: HTMLElement): void {
    event.preventDefault();
    event.stopPropagation();
    
    this.resizing.set(true);
    this.resizeColumnIndex.set(colIndex);
    this.startX = this.getClientX(event);
    this.startWidth = thElement.offsetWidth;
    this.currentTh = thElement;

    const onMouseMove = (e: MouseEvent) => this.onResizeMove(e);
    const onMouseUp = (e: MouseEvent) => {
      this.onResizeEnd(e, colIndex);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    const onTouchMove = (e: TouchEvent) => this.onResizeMove(e);
    const onTouchEnd = (e: TouchEvent) => {
      this.onResizeEnd(e, colIndex);
      document.removeEventListener('touchmove', onTouchMove, touchMoveOptions);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('touchcancel', onTouchEnd);
    };

    const touchMoveOptions: AddEventListenerOptions = { passive: false };

    if (event instanceof TouchEvent) {
      document.addEventListener('touchmove', onTouchMove, touchMoveOptions);
      document.addEventListener('touchend', onTouchEnd);
      document.addEventListener('touchcancel', onTouchEnd);
    } else {
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    }
  }

  private onResizeMove(event: MouseEvent | TouchEvent): void {
    if (!this.resizing() || !this.currentTh) return;
    
    const diff = this.getClientX(event) - this.startX;
    const newWidth = Math.max(50, this.startWidth + diff);
    this.currentTh.style.width = `${newWidth}px`;
  }

  private onResizeEnd(_event: MouseEvent | TouchEvent, colIndex: number): void {
    if (!this.currentTh) return;

    const column = this.columns()[colIndex];
    if (column) {
      const finalWidth = this.currentTh.offsetWidth;
      this.columnResize.emit({ columnId: column.id, width: finalWidth });
    }

    this.resizing.set(false);
    this.resizeColumnIndex.set(null);
    this.currentTh = null;
  }

  private getClientX(event: MouseEvent | TouchEvent): number {
    if (event instanceof TouchEvent) {
      const touch = event.touches[0] ?? event.changedTouches[0];
      return touch?.clientX ?? 0;
    }

    return event.clientX;
  }
}
