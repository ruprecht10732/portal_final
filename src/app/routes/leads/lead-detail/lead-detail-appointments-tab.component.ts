import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { AccessDifficulty, AppointmentAttachmentResponse, AppointmentResponse } from '../../../core/services/appointments.types';
import type { SelectOption } from '../../../shared/components/select/select.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-lead-detail-appointments-tab',
  templateUrl: './lead-detail-appointments-tab.component.html',
  styleUrl: './lead-detail-appointments-tab.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, TranslatePipe],
})
export class LeadDetailAppointmentsTabComponent {
  appointments = input<AppointmentResponse[]>([]);
  appointmentsLoading = input<boolean>(false);
  appointmentsError = input<string | null>(null);
  showAppointmentForm = input<boolean>(false);
  appointmentSaving = input<boolean>(false);
  appointmentDate = input<string>('');
  appointmentTime = input<string>('');
  appointmentDurationMinutes = input<string>('');
  appointmentTitle = input<string>('');
  appointmentLocation = input<string>('');
  appointmentNotes = input<string>('');
  selectedAppointmentId = input<string | null>(null);
  selectedAppointment = input<AppointmentResponse | null>(null);
  minDate = input<string | null>('');
  canSaveAppointment = input<boolean>(false);
  canEditReport = input<boolean>(false);
  reportSaving = input<boolean>(false);
  reportMeasurements = input<string>('');
  reportAccessDifficulty = input<AccessDifficulty | null>(null);
  reportNotes = input<string>('');
  accessDifficultyOptions = input<SelectOption<AccessDifficulty>[]>([]);
  attachmentsLoading = input<boolean>(false);
  attachments = input<AppointmentAttachmentResponse[]>([]);
  attachmentFileKey = input<string>('');
  attachmentFileName = input<string>('');
  attachmentContentType = input<string>('');
  attachmentSizeBytes = input<string>('');
  attachmentSaving = input<boolean>(false);
  canAddAttachment = input<boolean>(false);
  formatHumanDateTime = input<(value: string | undefined) => string>((value) => value ?? '-');

  toggleAppointmentForm = output<void>();
  setAppointmentDate = output<string>();
  setAppointmentTime = output<string>();
  setAppointmentDurationMinutes = output<string>();
  setAppointmentTitle = output<string>();
  setAppointmentLocation = output<string>();
  setAppointmentNotes = output<string>();
  createAppointment = output<void>();
  selectAppointment = output<string>();
  setReportMeasurements = output<string>();
  setAccessDifficulty = output<string>();
  setReportNotes = output<string>();
  saveVisitReport = output<void>();
  setAttachmentFileKey = output<string>();
  setAttachmentFileName = output<string>();
  setAttachmentContentType = output<string>();
  setAttachmentSizeBytes = output<string>();
  addAttachment = output<void>();
}
