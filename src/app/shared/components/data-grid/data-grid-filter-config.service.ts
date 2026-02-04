import { Injectable, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { GridColumn } from './data-grid.types';

export type FilterInputType = 'text' | 'select';

export interface FilterUiConfig {
  inputType: FilterInputType;
  options?: readonly { label: string; value: string }[];
}

@Injectable({ providedIn: 'root' })
export class DataGridFilterConfigService {
  private readonly translate = inject(TranslateService);
  private readonly langChange = toSignal(this.translate.onLangChange, {
    initialValue: { lang: 'en', translations: {} },
  });

  getFilterUiConfig<T>(column: GridColumn<T> | null): FilterUiConfig {
    this.langChange();

    if (!column) {
      return { inputType: 'text' };
    }

    if (column.cellType === 'boolean') {
      return {
        inputType: 'select',
        options: [
          { label: this.translate.instant('dataGrid.filterActive'), value: 'active' },
          { label: this.translate.instant('dataGrid.filterInactive'), value: 'inactive' },
        ],
      };
    }

    if (column.selectOptions && column.selectOptions.length > 0) {
      return {
        inputType: 'select',
        options: column.selectOptions.map(option => ({
          label: option.label,
          value: this.normalizeValue(option.value),
        })),
      };
    }

    return { inputType: 'text' };
  }

  private normalizeValue(value: unknown): string {
    return typeof value === 'string' ? value : String(value);
  }
}
