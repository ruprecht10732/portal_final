import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { AccessDifficulty, LeadService, VisitHistory } from '../../../core/services/leads.types';
import type { SelectOption } from '../select/select.component';
import { ButtonComponent } from '../button/button.component';
import { CheckboxComponent } from '../checkbox/checkbox.component';
import { InputComponent } from '../input/input.component';
import { SelectComponent } from '../select/select.component';
import { TextareaComponent } from '../textarea/textarea.component';

@Component({
  selector: 'shared-visit-panel',
  templateUrl: './visit-panel.component.html',
  styleUrl: './visit-panel.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, CheckboxComponent, InputComponent, SelectComponent, TextareaComponent],
  host: {
    '[class]': "'block w-full'",
  },
})
export class VisitPanelComponent {
  selectedService = input<LeadService | null>(null);
  selectedScout = input<string | null>(null);
  assigneeOptions = input<SelectOption<string | null>[]>([]);
  accessDifficultyOptions = input<SelectOption<AccessDifficulty>[]>([]);

  showScheduleForm = input(false);
  showRescheduleForm = input(false);
  showSurveyForm = input(false);
  isEditingVisit = input(false);
  isVisitInFuture = input(false);
  saving = input(false);

  scheduledDate = input('');
  scheduledTime = input('');
  rescheduleDate = input('');
  rescheduleTime = input('');
  noShowNotes = input('');
  markAsNoShow = input(false);
  measurements = input('');
  accessDifficulty = input<AccessDifficulty | null>(null);
  surveyNotes = input('');
  surveyPhotos = input<File[]>([]);

  visitHistory = input<VisitHistory[]>([]);

  formatHumanDateTime = input<(value: string | undefined) => string>((value) => value ?? '-');
  getUserLabelById = input<(id: string | null | undefined) => string>(() => 'Unassigned');
  getOutcomeLabel = input<(outcome: string) => string>(() => '');
  getOutcomeColor = input<(outcome: string) => string>(() => '');

  scheduledDateChange = output<string>();
  scheduledTimeChange = output<string>();
  selectedScoutChange = output<string | null>();
  showScheduleFormChange = output<boolean>();
  scheduleVisit = output<void>();

  showSurveyFormChange = output<boolean>();
  editVisit = output<void>();
  cancelEditVisit = output<void>();
  completeSurvey = output<void>();
  measurementsChange = output<string>();
  accessDifficultyChange = output<AccessDifficulty | null>();
  surveyNotesChange = output<string>();
  surveyPhotosChange = output<FileList | null>();

  showRescheduleFormChange = output<boolean>();
  rescheduleDateChange = output<string>();
  rescheduleTimeChange = output<string>();
  noShowNotesChange = output<string>();
  markAsNoShowChange = output<boolean>();
  rescheduleVisit = output<void>();
}
