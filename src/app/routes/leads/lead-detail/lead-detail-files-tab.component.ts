import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { AppointmentAttachmentResponse } from '../../../core/services/appointments.types';
import { TranslatePipe } from '@ngx-translate/core';
import type { LeadServiceAttachment } from '../../../core/services/leads.types';
import { FileUploaderComponent, type FileUploadError, type PresignedUpload } from '../../../shared/components/file-uploader/file-uploader.component';

@Component({
  selector: 'app-lead-detail-files-tab',
  templateUrl: './lead-detail-files-tab.component.html',
  styleUrl: './lead-detail-files-tab.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FileUploaderComponent, TranslatePipe],
})
export class LeadDetailFilesTabComponent {
  hasSelectedService = input<boolean>(false);
  serviceAttachmentError = input<string | null>(null);
  serviceAttachmentUploading = input<boolean>(false);
  serviceAttachmentsLoading = input<boolean>(false);
  serviceAttachments = input<LeadServiceAttachment[]>([]);
  serviceAttachmentDeleting = input<string | null>(null);
  maxServiceAttachmentSizeBytes = input<number>(0);
  formatFileSize = input<(value: number) => string>(String);
  selectedAppointmentTitle = input<string | null>(null);
  appointmentAttachmentsLoading = input<boolean>(false);
  appointmentAttachments = input<AppointmentAttachmentResponse[]>([]);
  presign = input<((file: File) => Promise<PresignedUpload>) | null>(null);
  finalize = input<((file: File, presigned: PresignedUpload) => Promise<LeadServiceAttachment>) | null>(null);

  uploadError = output<FileUploadError | null>();
  uploaded = output<LeadServiceAttachment>();
  uploadingChange = output<boolean>();
  downloadAttachment = output<LeadServiceAttachment>();
  deleteAttachment = output<string>();
  downloadAppointmentAttachment = output<AppointmentAttachmentResponse>();
}
