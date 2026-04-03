import { ChangeDetectionStrategy, Component, model, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { type FlowSettings } from '../flow-builder.types';

@Component({
  selector: 'app-flow-settings-dialog',
  imports: [FormsModule],
  templateUrl: './flow-settings-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FlowSettingsDialogComponent {
  settings = model.required<FlowSettings>();
  close = output<void>();

  protected updateField<K extends keyof FlowSettings>(key: K, value: FlowSettings[K]): void {
    this.settings.set({ ...this.settings(), [key]: value });
  }
}
