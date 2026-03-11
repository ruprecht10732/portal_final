import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { SelectComponent, type SelectOption } from '../../../shared/components/select/select.component';

@Component({
  selector: 'app-lead-detail-workflow-panel',
  templateUrl: './lead-detail-workflow-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, SelectComponent, TranslatePipe],
})
export class LeadDetailWorkflowPanelComponent {
  workflowOptions = input<SelectOption<string | null>[]>([]);
  selectedWorkflowId = input<string | null>(null);
  workflowSaving = input(false);
  workflowError = input<string | null>(null);
  resolutionSource = input<string | null>(null);

  workflowSelectionChange = output<string | null>();
  save = output<void>();
  useDefault = output<void>();
}