/**
 * Data Grid Body Component
 * Renders grid rows with inline editing support and keyboard navigation
 */

import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  output,
  signal,
  viewChildren,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CellEditEvent,
  CellPosition,
  GridColumn,
  RowState,
} from './data-grid.types';
import { OptionLabelPipe } from './data-grid.pipes';
import { CheckboxComponent } from '../checkbox/checkbox.component';

@Component({
  selector: 'data-grid-body',
  imports: [FormsModule, OptionLabelPipe, CheckboxComponent],
  templateUrl: './data-grid-body.component.html',
  styleUrl: './data-grid-body.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'role': 'rowgroup',
  },
})
export class DataGridBodyComponent<T extends Record<string, unknown>> {
  // ============ Inputs ============
  
  readonly columns = input<GridColumn<T>[]>([]);
  readonly rows = input<RowState<T>[]>([]);
  readonly focusedCell = input<CellPosition | null>(null);
  readonly editingCell = input<CellPosition | null>(null);
  readonly selectable = input<boolean>(true);
  readonly rowIdField = input<keyof T>('id' as keyof T);

  // ============ Outputs ============
  
  readonly cellFocus = output<CellPosition>();
  readonly cellEdit = output<{ rowIndex: number; columnIndex: number }>();
  readonly cellValueChange = output<{ rowIndex: number; columnId: string; value: unknown }>();
  readonly cellEditComplete = output<boolean>();
  readonly rowSelect = output<number>();
  readonly navigate = output<'up' | 'down' | 'left' | 'right' | 'home' | 'end'>();
  readonly cellEditEvent = output<CellEditEvent<T>>();

  // ============ View Children ============
  
  private readonly cellRefs = viewChildren<ElementRef<HTMLTableCellElement>>('cellRef');
  private readonly inputRefs = viewChildren<ElementRef<HTMLInputElement>>('inputRef');

  // ============ Internal State ============
  
  protected readonly tempEditValue = signal<unknown>(null);

  // ============ Methods ============
  
  protected isCellFocused(rowIndex: number, columnIndex: number): boolean {
    const focused = this.focusedCell();
    return focused?.rowIndex === rowIndex && focused?.columnIndex === columnIndex;
  }

  protected isCellEditing(rowIndex: number, columnIndex: number): boolean {
    const editing = this.editingCell();
    return editing?.rowIndex === rowIndex && editing?.columnIndex === columnIndex;
  }

  protected getCellValue(row: RowState<T>, column: GridColumn<T>): unknown {
    return row.current[column.field as keyof T];
  }

  /** Get safe value for input binding (avoids "undefined" string) */
  protected getInputValue(row: RowState<T>, column: GridColumn<T>): string | number {
    const value = row.current[column.field as keyof T];
    if (value === null || value === undefined) {
      return '';
    }
    return value as string | number;
  }

  /** Get display value as string for title attribute */
  protected getCellDisplayValue(row: RowState<T>, column: GridColumn<T>): string {
    const value = row.current[column.field as keyof T];
    
    if (value === null || value === undefined || value === '') {
      return '';
    }
    
    if (column.cellType === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    
    if (column.cellType === 'select' && column.selectOptions) {
      const option = column.selectOptions.find(o => o.value === value);
      return option?.label ?? String(value);
    }
    
    return String(value);
  }

  protected getCellError(row: RowState<T>, columnId: string): string | null {
    return row.cellErrors[columnId] ?? null;
  }

  protected onCellClick(rowIndex: number, columnIndex: number): void {
    this.cellFocus.emit({ rowIndex, columnIndex });
  }

  protected onCellDoubleClick(rowIndex: number, columnIndex: number): void {
    const column = this.columns()[columnIndex];
    if (!column.editable) return;
    
    // Store original value for potential revert
    const row = this.rows()[rowIndex];
    this.tempEditValue.set(row.current[column.field as keyof T]);
    
    this.cellEdit.emit({ rowIndex, columnIndex });
  }

  protected onCellKeydown(event: KeyboardEvent, rowIndex: number, columnIndex: number): void {
    const column = this.columns()[columnIndex];
    const isEditing = this.isCellEditing(rowIndex, columnIndex);
    
    const handlers: Record<string, () => void> = {
      'ArrowUp': () => this.handleArrowNavigation(event, 'up'),
      'ArrowDown': () => this.handleArrowNavigation(event, 'down'),
      'ArrowLeft': () => this.handleHorizontalNavigation(event, 'left', isEditing),
      'ArrowRight': () => this.handleHorizontalNavigation(event, 'right', isEditing),
      'Home': () => this.handleHomeEnd(event, 'home', isEditing),
      'End': () => this.handleHomeEnd(event, 'end', isEditing),
      'Enter': () => this.handleEnterKey(event, rowIndex, columnIndex, column, isEditing),
      'Escape': () => this.handleEscapeKey(event, isEditing),
      'Tab': () => this.handleTabKey(rowIndex, columnIndex, isEditing),
      ' ': () => this.handleSpaceKey(event, rowIndex, isEditing),
    };

    const handler = handlers[event.key];
    if (handler) {
      handler();
    } else {
      this.handleAlphanumericKey(event, rowIndex, columnIndex, column, isEditing);
    }
  }

  private handleArrowNavigation(event: KeyboardEvent, direction: 'up' | 'down'): void {
    event.preventDefault();
    this.navigate.emit(direction);
  }

  private handleHorizontalNavigation(event: KeyboardEvent, direction: 'left' | 'right', isEditing: boolean): void {
    if (!isEditing) {
      event.preventDefault();
      this.navigate.emit(direction);
    }
  }

  private handleHomeEnd(event: KeyboardEvent, direction: 'home' | 'end', isEditing: boolean): void {
    if (event.ctrlKey || !isEditing) {
      event.preventDefault();
      this.navigate.emit(direction);
    }
  }

  private handleEnterKey(event: KeyboardEvent, rowIndex: number, columnIndex: number, column: GridColumn<T>, isEditing: boolean): void {
    event.preventDefault();
    if (isEditing) {
      this.commitEdit(rowIndex, columnIndex);
    } else if (column.editable) {
      const row = this.rows()[rowIndex];
      this.tempEditValue.set(row.current[column.field as keyof T]);
      this.cellEdit.emit({ rowIndex, columnIndex });
    }
  }

  private handleEscapeKey(event: KeyboardEvent, isEditing: boolean): void {
    if (isEditing) {
      event.preventDefault();
      this.cancelEdit();
    }
  }

  private handleTabKey(rowIndex: number, columnIndex: number, isEditing: boolean): void {
    if (isEditing) {
      this.commitEdit(rowIndex, columnIndex);
    }
  }

  private handleSpaceKey(event: KeyboardEvent, rowIndex: number, isEditing: boolean): void {
    if (!isEditing) {
      event.preventDefault();
      this.rowSelect.emit(rowIndex);
    }
  }

  private handleAlphanumericKey(event: KeyboardEvent, rowIndex: number, columnIndex: number, column: GridColumn<T>, isEditing: boolean): void {
    if (column.editable && !isEditing && event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
      this.tempEditValue.set(event.key);
      this.cellEdit.emit({ rowIndex, columnIndex });
    }
  }

  protected onInputChange(rowIndex: number, columnId: string, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.cellValueChange.emit({ rowIndex, columnId, value });
  }

  protected onInputBlur(rowIndex: number, columnIndex: number): void {
    // Commit on blur unless cancelled
    const editing = this.editingCell();
    if (editing?.rowIndex === rowIndex && editing?.columnIndex === columnIndex) {
      this.commitEdit(rowIndex, columnIndex);
    }
  }

  protected onRowSelect(rowIndex: number): void {
    this.rowSelect.emit(rowIndex);
  }

  private commitEdit(rowIndex: number, columnIndex: number): void {
    const row = this.rows()[rowIndex];
    const column = this.columns()[columnIndex];
    const oldValue = this.tempEditValue();
    const newValue = row.current[column.field as keyof T];
    
    // Emit cell edit event if value changed
    if (oldValue !== newValue) {
      this.cellEditEvent.emit({
        rowId: row.current[this.rowIdField()] as string | number,
        columnId: column.id,
        oldValue,
        newValue,
        row: row.current,
      });
    }
    
    this.cellEditComplete.emit(true);
  }

  private cancelEdit(): void {
    this.cellEditComplete.emit(false);
  }

  protected getInputType(column: GridColumn<T>): string {
    switch (column.cellType) {
      case 'number':
        return 'number';
      case 'date':
        return 'date';
      default:
        return 'text';
    }
  }

  protected trackByRowId(index: number, row: RowState<T>): string | number {
    return row.current[this.rowIdField()] as string | number ?? index;
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
