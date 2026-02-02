/* eslint-disable @angular-eslint/component-selector */
import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, input, output, signal, viewChild } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonComponent } from '../button/button.component';
import type { LogCallResponse } from '../../../core/services/leads.types';

export interface CallLoggerSubmitEvent {
  summary: string;
  sendConfirmationEmail: boolean;
}

@Component({
  selector: 'shared-call-logger-dialog',
  templateUrl: './call-logger-dialog.component.html',
  styleUrl: './call-logger-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, TranslatePipe],
  host: {
    '[class.pointer-events-none]': '!isOpen()',
  },
})
export class CallLoggerDialogComponent {
  readonly isOpen = input<boolean>(false);
  readonly isProcessing = input<boolean>(false);
  readonly result = input<LogCallResponse | null>(null);
  readonly closeOnBackdrop = input<boolean>(true);
  readonly missingInformation = input<string[]>([]);

  readonly submitSummary = output<CallLoggerSubmitEvent>();
  readonly dismiss = output<void>();

  protected readonly summaryText = signal('');
  protected readonly sendConfirmationEmail = signal(true);
  protected readonly textareaRef = viewChild<ElementRef<HTMLTextAreaElement>>('summaryTextarea');

  protected readonly dialogId = signal(`call-logger-${Math.random().toString(36).slice(2, 9)}`);
  protected readonly titleId = computed(() => `${this.dialogId()}-title`);
  protected readonly descriptionId = computed(() => `${this.dialogId()}-description`);

  protected readonly canSubmit = computed(() => {
    const text = this.summaryText().trim();
    return text.length > 0 && !this.isProcessing() && !this.result();
  });

  protected readonly showResult = computed(() => !!this.result());
  protected readonly hasMissingInfo = computed(() => this.missingInformation().length > 0);

  constructor() {
    // Focus textarea when dialog opens
    effect(() => {
      if (!this.isOpen()) {
        // Reset state when dialog closes
        this.summaryText.set('');
        this.sendConfirmationEmail.set(true);
        return;
      }
      queueMicrotask(() => {
        this.textareaRef()?.nativeElement?.focus();
      });
    });
  }

  protected onBackdropClick(): void {
    if (this.closeOnBackdrop() && !this.isProcessing()) {
      this.dismiss.emit();
    }
  }

  protected onCancelClick(): void {
    if (!this.isProcessing()) {
      this.dismiss.emit();
    }
  }

  protected onSubmitClick(): void {
    if (this.canSubmit()) {
      this.submitSummary.emit({
        summary: this.summaryText().trim(),
        sendConfirmationEmail: this.sendConfirmationEmail(),
      });
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    // Submit on Ctrl+Enter or Cmd+Enter
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && this.canSubmit()) {
      event.preventDefault();
      this.onSubmitClick();
    }
  }

  protected toggleEmailConfirmation(): void {
    this.sendConfirmationEmail.set(!this.sendConfirmationEmail());
  }
}
