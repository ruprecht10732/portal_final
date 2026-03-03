import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { DomSanitizer, type SafeResourceUrl } from '@angular/platform-browser';
import { LucideAngularModule } from 'lucide-angular';
import { ButtonComponent } from '../button/button.component';

@Component({
  selector: 'shared-file-preview-dialog',
  templateUrl: './file-preview-dialog.component.html',
  styleUrl: './file-preview-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, LucideAngularModule],
  host: {
    '[class.pointer-events-none]': '!isOpen()',
  },
})
export class FilePreviewDialogComponent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly isOpen = input<boolean>(false);
  readonly title = input<string>('');
  readonly fileUrl = input<string | null>(null);
  readonly fileName = input<string>('');
  readonly contentType = input<string | null>(null);
  readonly isLoading = input<boolean>(false);
  readonly error = input<string | null>(null);
  readonly closeOnBackdrop = input<boolean>(true);

  readonly closed = output<void>();

  protected readonly dialogId = `file-preview-${Math.random().toString(36).slice(2, 9)}`;
  protected readonly titleId = computed(() => `${this.dialogId}-title`);
  protected readonly descriptionId = computed(() => `${this.dialogId}-description`);

  protected readonly isImage = computed(() => {
    const contentType = this.contentType();
    if (contentType?.startsWith('image/')) return true;
    const name = this.fileName();
    const extension = name.split('.').pop()?.toLowerCase();
    if (!extension) return false;
    return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(extension);
  });

  protected readonly safeUrl = computed<SafeResourceUrl | null>(() => {
    const url = this.fileUrl();
    if (!url) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });

  protected onBackdropClick(): void {
    if (this.closeOnBackdrop()) {
      this.closed.emit();
    }
  }

  protected onCloseClick(): void {
    this.closed.emit();
  }
}
