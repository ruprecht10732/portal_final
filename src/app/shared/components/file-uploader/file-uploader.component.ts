import { ChangeDetectionStrategy, Component, ElementRef, computed, input, output, signal, viewChild } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
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
  protected readonly selectedFile = signal<File | null>(null);
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
    const file = input?.files?.[0] ?? null;
    this.setSelectedFile(file);
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
    const file = event.dataTransfer?.files?.[0] ?? null;
    this.isDragging.set(false);
    this.setSelectedFile(file);
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
    this.selectedFile.set(null);
    const input = this.fileInput()?.nativeElement;
    if (input) input.value = '';
  }

  protected async upload(): Promise<void> {
    if (this.uploading() || this.disabled()) return;

    const file = this.selectedFile();
    if (!file) return;

    const presign = this.presign();
    const finalize = this.finalize();

    if (!presign || !finalize) {
      this.handleError(new Error('Missing upload handlers'));
      return;
    }

    const maxSize = this.maxSizeBytes();
    if (maxSize && file.size > maxSize) {
      const message = `${this.maxSizeError()} (${this.formatFileSize(maxSize)})`;
      this.handleError(new Error(message), message);
      return;
    }

    this.uploading.set(true);
    this.uploadingChange.emit(true);
    this.errorMessage.set(null);
    this.uploadError.emit(null);
    this.uploadProgress.set(0);

    try {
      const presigned = await presign(file);
      await this.uploadFileToUrl(presigned.uploadUrl, file);
      const result = await finalize(file, presigned);
      this.uploaded.emit(result);
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
    const message = this.getErrorMessage(error, fallbackOverride ?? this.errorFallback());
    this.errorMessage.set(message);
    this.uploadError.emit({ message, error });
  }

  private setSelectedFile(file: File | null): void {
    this.selectedFile.set(file);
    this.errorMessage.set(null);
    this.uploadError.emit(null);
  }

  private uploadFileToUrl(url: string, file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          this.uploadProgress.set(progress);
        }
      });

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

  private getErrorMessage(error: unknown, fallback: string): string {
    if (error && typeof error === 'object' && 'error' in error) {
      const nested = (error as { error?: { error?: string } | string }).error;
      if (typeof nested === 'string') return nested;
      if (nested && typeof nested === 'object' && 'error' in nested && typeof nested.error === 'string') {
        return nested.error;
      }
    }
    if (error instanceof Error && error.message) return error.message;
    return fallback;
  }
}
