import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'shared-field-shell',
  templateUrl: './field-shell.component.html',
  styleUrl: './field-shell.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FieldShellComponent {
  label = input<string>('');
  required = input(false);
  hint = input<string>('');
  error = input<string>('');
  uid = input<string>('');
  hintId = input<string>('');
  errorId = input<string>('');
  showLabel = input(true);
  showFeedback = input(true);
}
