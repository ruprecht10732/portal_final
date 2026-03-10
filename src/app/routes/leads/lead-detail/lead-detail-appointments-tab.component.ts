import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FileUploaderComponent, type FileUploadError, type PresignedUpload } from '../../../shared/components/file-uploader/file-uploader.component';
import type { AccessDifficulty, AppointmentAttachmentResponse, AppointmentResponse } from '../../../core/services/appointments.types';
import type { SelectOption } from '../../../shared/components/select/select.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-lead-detail-appointments-tab',
  templateUrl: './lead-detail-appointments-tab.component.html',
  styleUrl: './lead-detail-appointments-tab.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, FileUploaderComponent, TranslatePipe],
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
  attachmentSaving = input<boolean>(false);
  maxAttachmentSizeBytes = input<number>(0);
  attachmentUploadError = input<string | null>(null);
  presignAttachment = input<((file: File) => Promise<PresignedUpload>) | null>(null);
  finalizeAttachment = input<((file: File, presigned: PresignedUpload) => Promise<AppointmentAttachmentResponse>) | null>(null);
  approvingAppointmentId = input<string | null>(null);
  formatHumanDateTime = input<(value: string | undefined) => string>((value) => value ?? '-');

  approveAppointment = output<string>();
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
  attachmentUploadingChange = output<boolean>();
  attachmentUploadErrorChange = output<FileUploadError | null>();
  attachmentUploaded = output<AppointmentAttachmentResponse>();
  downloadAttachment = output<AppointmentAttachmentResponse>();
}
