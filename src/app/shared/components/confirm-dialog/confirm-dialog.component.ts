import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, input, output, viewChild } from '@angular/core';
import { ButtonComponent } from '../button/button.component';

@Component({
  selector: 'shared-confirm-dialog',
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent],
  host: {
    '[class.pointer-events-none]': '!isOpen()',
  },
})
export class ConfirmDialogComponent {
  readonly isOpen = input<boolean>(false);
  readonly title = input<string>('Confirm');
  readonly message = input<string>('');
  readonly confirmText = input<string>('Confirm');
  readonly cancelText = input<string>('Cancel');
  readonly confirmVariant = input<'primary' | 'secondary' | 'danger'>('danger');
  readonly confirmDisabled = input<boolean>(false);
  readonly closeOnBackdrop = input<boolean>(true);

  readonly confirm = output<void>();
  readonly cancelled = output<void>();

  private readonly confirmButtonRef = viewChild<ElementRef<HTMLButtonElement>>('confirmButton');

  protected readonly dialogId = `confirm-${Math.random().toString(36).slice(2, 9)}`;
  protected readonly titleId = computed(() => `${this.dialogId}-title`);
  protected readonly descriptionId = computed(() => `${this.dialogId}-description`);

  constructor() {
    effect(() => {
      if (!this.isOpen()) return;
      queueMicrotask(() => {
        this.confirmButtonRef()?.nativeElement?.focus();
      });
    });
  }

  protected onBackdropClick(): void {
    if (this.closeOnBackdrop()) {
      this.cancelled.emit();
    }
  }

  protected onCancelClick(): void {
    this.cancelled.emit();
  }

  protected onConfirmClick(): void {
    if (!this.confirmDisabled()) {
      this.confirm.emit();
    }
  }
}
