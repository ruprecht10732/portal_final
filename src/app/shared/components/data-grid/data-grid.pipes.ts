/**
 * Data Grid Pipes
 * Utility pipes for data grid templates
 */

import { Pipe, PipeTransform } from '@angular/core';
import { GridColumn, RowState } from './data-grid.types';

/**
 * Get column label by ID
 */
@Pipe({
  name: 'columnLabel',
})
export class ColumnLabelPipe implements PipeTransform {
  transform<T>(columns: GridColumn<T>[], columnId: string): string {
    const column = columns.find(c => c.id === columnId);
    return column?.header ?? columnId;
  }
}

/**
 * Get option label from select options
 */
@Pipe({
  name: 'optionLabel',
})
export class OptionLabelPipe implements PipeTransform {
  transform(options: readonly { label: string; value: unknown }[] | undefined, value: unknown): string {
    if (!options) {
      return this.valueToString(value);
    }
    const option = options.find((o) => o.value === value);
    if (option?.label) return option.label;
    return this.valueToString(value);
  }

  private valueToString(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return JSON.stringify(value);
  }
}

/**
 * Extract current data from dirty rows
 */
@Pipe({
  name: 'dirtyRowsData',
})
export class DirtyRowsDataPipe implements PipeTransform {
  transform<T>(rows: RowState<T>[]): T[] {
    return rows.filter(r => r.dirty).map(r => r.current);
  }
}

/**
 * Extract current data from selected rows
 */
@Pipe({
  name: 'selectedRowsData',
})
export class SelectedRowsDataPipe implements PipeTransform {
  transform<T>(rows: RowState<T>[]): T[] {
    return rows.filter(r => r.selected).map(r => r.current);
  }
}
