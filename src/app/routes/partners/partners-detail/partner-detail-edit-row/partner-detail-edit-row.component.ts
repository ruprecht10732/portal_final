import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-partner-detail-edit-row',
  templateUrl: './partner-detail-edit-row.component.html',
  styleUrl: './partner-detail-edit-row.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, LucideAngularModule],
})
export class PartnerDetailEditRowComponent {
  readonly labelKey = input.required<string>();
  readonly value = input<string>('');
  readonly editable = input(true);
  readonly isEditing = input(false);
  readonly editValue = input('');

  readonly startEdit = output<void>();
  readonly cancelEdit = output<void>();
  readonly saveEdit = output<void>();
  readonly editValueChange = output<string>();
}
