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
  viewChildren,
} from '@angular/core';
import {
  CellEditEvent,
  CellPosition,
  GridColumn,
  RowState,
} from './data-grid.types';
import { OptionLabelPipe } from './data-grid.pipes';
import { CheckboxComponent } from '../checkbox/checkbox.component';
import { ContentEditableValueDirective } from './contenteditable-value.directive';

@Component({
  selector: 'data-grid-body',
  imports: [OptionLabelPipe, CheckboxComponent, ContentEditableValueDirective],
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
  private readonly inputRefs = viewChildren<ElementRef<HTMLElement>>('inputRef');

  // ============ Methods ============
  
  protected isCellFocused(rowIndex: number, columnIndex: number): boolean {
    const focused = this.focusedCell();
    return focused?.rowIndex === rowIndex && focused?.columnIndex === columnIndex;
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

  protected onCellKeydown(event: KeyboardEvent, rowIndex: number, columnIndex: number): void {
    const column = this.columns()[columnIndex];
    const isInteractive = this.isInteractiveElement(event.target);

    if (isInteractive) {
      return;
    }
    
    const handlers: Record<string, () => void> = {
      'ArrowUp': () => this.handleArrowNavigation(event, 'up'),
      'ArrowDown': () => this.handleArrowNavigation(event, 'down'),
      'ArrowLeft': () => this.handleHorizontalNavigation(event, 'left'),
      'ArrowRight': () => this.handleHorizontalNavigation(event, 'right'),
      'Home': () => this.handleHomeEnd(event, 'home'),
      'End': () => this.handleHomeEnd(event, 'end'),
      'Enter': () => this.handleEnterKey(event, rowIndex, column, columnIndex),
      ' ': () => this.handleSpaceKey(event, rowIndex),
    };

    const handler = handlers[event.key];
    if (handler) {
      handler();
    } else {
      this.handleAlphanumericKey(event, rowIndex, column, columnIndex);
    }
  }

  private handleArrowNavigation(event: KeyboardEvent, direction: 'up' | 'down'): void {
    event.preventDefault();
    this.navigate.emit(direction);
  }

  private handleHorizontalNavigation(event: KeyboardEvent, direction: 'left' | 'right'): void {
    event.preventDefault();
    this.navigate.emit(direction);
  }

  private handleHomeEnd(event: KeyboardEvent, direction: 'home' | 'end'): void {
    if (event.ctrlKey || event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      this.navigate.emit(direction);
    }
  }

  private handleEnterKey(event: KeyboardEvent, rowIndex: number, column: GridColumn<T>, columnIndex: number): void {
    if (!column.editable) return;
    const control = this.getEditableControl(event);
    if (control) {
      event.preventDefault();
      control.focus();
      this.placeCaretAtEnd(control);
    } else {
      event.preventDefault();
      this.navigate.emit('down');
    }
  }

  private handleSpaceKey(event: KeyboardEvent, rowIndex: number): void {
    event.preventDefault();
    this.rowSelect.emit(rowIndex);
  }

  private handleAlphanumericKey(event: KeyboardEvent, rowIndex: number, column: GridColumn<T>, columnIndex: number): void {
    if (column.editable && event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
      const control = this.getEditableControl(event);
      if (!control) return;

      event.preventDefault();
      control.focus();

      if (control.isContentEditable) {
        control.textContent = event.key;
        this.placeCaretAtEnd(control);
        this.emitCellValueChange(rowIndex, column, this.parseEditableValue(column, control.textContent ?? ''));
      } else if (control instanceof HTMLInputElement && control.type !== 'checkbox' && control.type !== 'date') {
        control.value = event.key;
        this.onInputChange(rowIndex, column, control);
      }
    }
  }

  protected onInputChange(
    rowIndex: number,
    column: GridColumn<T>,
    eventOrTarget: Event | HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  ): void {
    const target = eventOrTarget instanceof Event
      ? eventOrTarget.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      : eventOrTarget;
    const value = column.cellType === 'boolean' && target instanceof HTMLInputElement
      ? target.checked
      : target.value;

    this.emitCellValueChange(rowIndex, column, value);
  }

  protected onEditableInput(
    rowIndex: number,
    column: GridColumn<T>,
    event: Event,
  ): void {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const text = target.textContent ?? '';
    this.emitCellValueChange(rowIndex, column, this.parseEditableValue(column, text));
  }

  protected onEditableFocus(
    rowIndex: number,
    columnIndex: number,
    column: GridColumn<T>,
    event: FocusEvent,
  ): void {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    this.cellFocus.emit({ rowIndex, columnIndex });

    const value = this.getEditableDisplayValue(this.rows()[rowIndex], column);
    if (target.textContent !== value) {
      target.textContent = value;
    }

    this.placeCaretAtEnd(target);
  }

  protected onEditableEnter(
    event: Event,
    rowIndex: number,
    column: GridColumn<T>,
  ): void {
    event.preventDefault();
    event.stopPropagation();
    const target = event.target as HTMLElement | null;
    if (target) {
      const text = target.textContent ?? '';
      this.emitCellValueChange(rowIndex, column, this.parseEditableValue(column, text));
    }
    this.navigate.emit('down');
  }

  protected onRowSelect(rowIndex: number): void {
    this.rowSelect.emit(rowIndex);
  }

  private isInteractiveElement(target: EventTarget | null): boolean {
    if (target instanceof HTMLElement && target.isContentEditable) {
      return true;
    }
    return target instanceof HTMLInputElement
      || target instanceof HTMLSelectElement
      || target instanceof HTMLTextAreaElement;
  }

  private getEditableControl(event: Event): HTMLElement | null {
    const cell = event.currentTarget as HTMLElement | null;
    if (!cell) return null;
    return cell.querySelector('[contenteditable="true"], input, select, textarea');
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

  protected getEditableDisplayValue(row: RowState<T>, column: GridColumn<T>): string {
    const value = row.current[column.field as keyof T];
    if (value === null || value === undefined) {
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

  private emitCellValueChange(rowIndex: number, column: GridColumn<T>, value: unknown): void {
    const row = this.rows()[rowIndex];
    const oldValue = row.current[column.field as keyof T];

    if (oldValue !== value) {
      this.cellEditEvent.emit({
        rowId: row.current[this.rowIdField()] as string | number,
        columnId: column.id,
        oldValue,
        newValue: value,
        row: row.current,
      });
    }

    this.cellValueChange.emit({ rowIndex, columnId: column.id, value });
  }

  private parseEditableValue(column: GridColumn<T>, text: string): unknown {
    const trimmed = text.trim();

    if (column.cellType === 'boolean') {
      if (trimmed === '') return false;
      const normalized = trimmed.toLowerCase();
      return normalized === 'true'
        || normalized === 'yes'
        || normalized === '1'
        || normalized === 'y';
    }

    if (column.cellType === 'number') {
      const parsed = Number.parseFloat(trimmed);
      return Number.isNaN(parsed) ? trimmed : parsed;
    }

    if (column.cellType === 'select' && column.selectOptions) {
      const match = column.selectOptions.find(option =>
        String(option.value) === trimmed || option.label.toLowerCase() === trimmed.toLowerCase(),
      );
      return match ? match.value : trimmed;
    }

    return trimmed;
  }

  private placeCaretAtEnd(element: HTMLElement): void {
    if (!element.isContentEditable) return;
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    const selection = globalThis.getSelection?.();
    if (!selection) return;
    selection.removeAllRanges();
    selection.addRange(range);
  }

  /** Calculate left position for frozen columns */
  protected getFrozenColumnLeft(columnIndex: number): string {
    const cols = this.columns();
    let left = this.selectable() ? 40 : 0; // checkbox column width
    
    for (let i = 0; i < columnIndex; i++) {
      if (cols[i]?.frozen) {
        // Use minWidth or default
        const width = cols[i].minWidth ?? cols[i].width ?? '150px';
        left += Number.parseInt(width, 10) || 150;
      }
    }
    
    return `${left}px`;
  }

  /** Get tooltip text explaining row status */
  protected getRowStatusTooltip(row: RowState<T>): string | null {
    if (row.saving) return 'Saving...';
    if (row.error) return `Error: ${row.error}`;
    if (row.recentlyUpdated) return 'Recently saved';
    if (row.isNew) return 'New row (unsaved)';
    if (row.dirty) return 'Unsaved changes';
    return null;
  }
}
