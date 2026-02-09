import { ChangeDetectionStrategy, Component, ElementRef, computed, input, output, signal, viewChild } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { extractErrorMessage } from '../../../core/utils/error-utils';
import { ButtonComponent } from '../button/button.component';

export interface PresignedUpload {
  uploadUrl: string;
  fileKey: string;
}

export interface FileUploadError {
  message: string;
  error: unknown;
}

@Component({
  selector: 'app-file-uploader',
  imports: [ButtonComponent, TranslatePipe],
  templateUrl: './file-uploader.component.html',
  styleUrl: './file-uploader.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.display]': "'block'",
  },
})
export class FileUploaderComponent {
  label = input('Select file');
  dropLabel = input('Drop a file here or click to browse');
  helpText = input('');
  accept = input('');
  multiple = input(false);
  maxSizeBytes = input<number | null>(null);
  maxSizeError = input('File size exceeds maximum allowed');
  disabled = input(false);
  buttonLabel = input('Upload');
  uploadingLabel = input('Uploading...');
  errorFallback = input('Upload failed');

  presign = input<((file: File) => Promise<PresignedUpload>) | null>(null);
  finalize = input<((file: File, presigned: PresignedUpload) => Promise<unknown>) | null>(null);

  uploaded = output<unknown>();
  uploadError = output<FileUploadError | null>();
  uploadingChange = output<boolean>();

  protected readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');
  protected readonly selectedFiles = signal<File[]>([]);
  protected readonly selectedFirst = computed<File | null>(() => this.selectedFiles()[0] ?? null);
  protected readonly uploadProgress = signal<number | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly isDragging = signal(false);
  protected readonly uploading = signal(false);

  protected readonly hasMaxSize = computed(() => {
    const maxSize = this.maxSizeBytes();
    return typeof maxSize === 'number' && maxSize > 0;
  });

  protected readonly maxSizeLabel = computed(() => {
    const maxSize = this.maxSizeBytes();
    if (!maxSize) return '';
    return this.formatFileSize(maxSize);
  });

  protected onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const files = Array.from(input?.files ?? []);
    this.setSelectedFiles(this.multiple() ? files : files.slice(0, 1));
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (this.disabled()) return;
    this.isDragging.set(true);
  }

  protected onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    if (this.disabled()) return;
    const files = Array.from(event.dataTransfer?.files ?? []);
    this.isDragging.set(false);
    this.setSelectedFiles(this.multiple() ? files : files.slice(0, 1));
  }

  protected onDropzoneKeydown(event: KeyboardEvent): void {
    if (this.disabled()) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.openFilePicker();
    }
  }

  protected openFilePicker(): void {
    if (this.disabled()) return;
    const input = this.fileInput()?.nativeElement;
    input?.click();
  }

  protected clearSelection(): void {
    this.selectedFiles.set([]);
    const input = this.fileInput()?.nativeElement;
    if (input) input.value = '';
  }

  protected removeFile(index: number): void {
    if (this.uploading()) return;
    const files = this.selectedFiles();
    if (index < 0 || index >= files.length) return;
    const next = files.slice(0, index).concat(files.slice(index + 1));
    this.selectedFiles.set(next);
  }

  protected async upload(): Promise<void> {
    if (this.uploading() || this.disabled()) return;

    const files = this.selectedFiles();
    if (files.length === 0) return;

    const presign = this.presign();
    const finalize = this.finalize();

    if (!presign || !finalize) {
      this.handleError(new Error('Missing upload handlers'));
      return;
    }

    this.uploading.set(true);
    this.uploadingChange.emit(true);
    this.errorMessage.set(null);
    this.uploadError.emit(null);
    this.uploadProgress.set(0);

    try {
      await this.uploadFiles(files, presign, finalize);
      this.clearSelection();
    } catch (error) {
      this.handleError(error);
    } finally {
      this.uploading.set(false);
      this.uploadingChange.emit(false);
      this.uploadProgress.set(null);
    }
  }

  private handleError(error: unknown, fallbackOverride?: string): void {
    const message = extractErrorMessage(error, fallbackOverride ?? this.errorFallback(), {
      allowErrorMessage: true,
    });
    this.errorMessage.set(message);
    this.uploadError.emit({ message, error });
  }

  private setSelectedFiles(files: File[]): void {
    this.selectedFiles.set(files);
    this.errorMessage.set(null);
    this.uploadError.emit(null);
  }

  private async uploadFiles(
    files: File[],
    presign: (file: File) => Promise<PresignedUpload>,
    finalize: (file: File, presigned: PresignedUpload) => Promise<unknown>,
  ): Promise<void> {
    const maxSize = this.maxSizeBytes();
    if (maxSize) {
      const tooLarge = files.find(file => file.size > maxSize);
      if (tooLarge) {
        const message = `${this.maxSizeError()} (${this.formatFileSize(maxSize)})`;
        throw new Error(message);
      }
    }

    if (!this.multiple()) {
      const first = files[0];
      if (!first) return;
      await this.uploadSingleFile(first, presign, finalize, true);
      return;
    }

    let completed = 0;
    const total = files.length;

    const tasks = files.map(file =>
      this.uploadSingleFile(file, presign, finalize, false).then(
        () => {
          completed += 1;
          this.uploadProgress.set(Math.round((completed / total) * 100));
        },
        error => {
          completed += 1;
          this.uploadProgress.set(Math.round((completed / total) * 100));
          throw error;
        },
      ),
    );

    const results = await Promise.allSettled(tasks);
    const failures = results.filter(result => result.status === 'rejected');
    if (failures.length > 0) {
      const message = failures.length === total
        ? this.errorFallback()
        : 'Sommige bestanden konden niet worden geupload.';
      throw new Error(message);
    }
  }

  private async uploadSingleFile(
    file: File,
    presign: (file: File) => Promise<PresignedUpload>,
    finalize: (file: File, presigned: PresignedUpload) => Promise<unknown>,
    trackProgress: boolean,
  ): Promise<void> {
    const presigned = await presign(file);
    await this.uploadFileToUrl(presigned.uploadUrl, file, trackProgress);
    const result = await finalize(file, presigned);
    this.uploaded.emit(result);
  }

  private uploadFileToUrl(url: string, file: File, trackProgress: boolean): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      if (trackProgress) {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100);
            this.uploadProgress.set(progress);
          }
        });
      }

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => reject(new Error('Upload failed')));
      xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));

      xhr.open('PUT', url);
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      xhr.send(file);
    });
  }

  protected formatFileSize(bytes: number): string {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

}
