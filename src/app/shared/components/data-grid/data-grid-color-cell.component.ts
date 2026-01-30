/**
 * Data Grid Color Cell Component
 * Inline color picker cell for editing hex colors in the data grid
 */

import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ColorPickerComponent } from '../color-picker/color-picker.component';

@Component({
  selector: 'data-grid-color-cell',
  imports: [ColorPickerComponent],
  template: `
    <shared-color-picker
      [compact]="true"
      [label]="''"
      [placeholder]="placeholder()"
      [value]="value() ?? ''"
      (valueChange)="valueChange.emit($event)"
    />
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataGridColorCellComponent {
  readonly value = input<string | null>(null);
  readonly placeholder = input<string>('#3B82F6');
  readonly valueChange = output<string>();
}
