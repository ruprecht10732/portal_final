import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { MultiSelectComponent, type MultiSelectOption } from '../../../../shared/components/multiselect/multiselect.component';

@Component({
  selector: 'app-partner-detail-services-card',
  templateUrl: './partner-detail-services-card.component.html',
  styleUrl: './partner-detail-services-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, LucideAngularModule, ButtonComponent, MultiSelectComponent],
})
export class PartnerDetailServicesCardComponent {
  readonly serviceTypeIds = input<string[]>([]);
  readonly serviceTypeLabels = input<Record<string, string>>({});
  readonly serviceTypesLoading = input(false);
  readonly serviceTypesError = input<string | null>(null);
  readonly serviceTypesEditing = input(false);
  readonly serviceTypesSaving = input(false);
  readonly serviceTypeOptions = input<MultiSelectOption<string>[]>([]);
  readonly serviceTypeSelection = input<string[]>([]);

  readonly openEdit = output<void>();
  readonly closeEdit = output<void>();
  readonly saveEdit = output<void>();
  readonly removeServiceType = output<string>();
  readonly selectionChange = output<string[]>();
}
