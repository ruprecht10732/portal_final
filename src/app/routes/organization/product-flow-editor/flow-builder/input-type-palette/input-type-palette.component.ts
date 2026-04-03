import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import {
  type InputFieldType,
  INPUT_FIELD_TYPES, INPUT_FIELD_CATEGORIES,
  getInputFieldTypesByCategory,
} from '../flow-builder.types';

@Component({
  selector: 'app-input-type-palette',
  imports: [],
  templateUrl: './input-type-palette.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InputTypePaletteComponent {
  selectType = output<InputFieldType>();

  protected readonly categories = INPUT_FIELD_CATEGORIES;
  protected readonly allTypes = INPUT_FIELD_TYPES;

  protected getTypesByCategory(categoryId: string) {
    return getInputFieldTypesByCategory(categoryId);
  }
}
