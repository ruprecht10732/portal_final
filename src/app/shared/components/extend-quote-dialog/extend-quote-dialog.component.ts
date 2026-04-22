import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ButtonComponent } from '../button/button.component';
import { InputComponent } from '../input/input.component';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'shared-extend-quote-dialog',
  templateUrl: './extend-quote-dialog.component.html',
  styleUrl: './extend-quote-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, InputComponent, TranslatePipe, ReactiveFormsModule],
  host: {
    '[class.pointer-events-none]': '!isOpen()',
  },
})
export class ExtendQuoteDialogComponent {
  readonly isOpen = input<boolean>(false);
  readonly currentValidUntil = input<string | undefined>();

  readonly confirm = output<{ extendDays: number }>();
  readonly cancelled = output<void>();

  private readonly fb = new FormBuilder();
  private readonly confirmButtonRef = viewChild<ElementRef<HTMLButtonElement>>('confirmButton');

  protected readonly dialogId = `extend-quote-${Math.random().toString(36).slice(2, 9)}`;
  protected readonly titleId = computed(() => `${this.dialogId}-title`);
  protected readonly descriptionId = computed(() => `${this.dialogId}-description`);

  protected readonly form: FormGroup = this.fb.group({
    extendDays: [30],
  });

  protected readonly extendDaysStr = computed(() => String(this.form.get('extendDays')?.value ?? 30));

  protected readonly newValidUntil = computed(() => {
    const days = this.form.get('extendDays')?.value ?? 30;
    if (!days || days < 1) return null;
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  });

  protected onExtendDaysChange(value: string): void {
    const num = Number.parseInt(value, 10);
    this.form.patchValue({ extendDays: Number.isNaN(num) ? 30 : num });
  }

  constructor() {
    effect(() => {
      if (!this.isOpen()) return;
      queueMicrotask(() => {
        this.confirmButtonRef()?.nativeElement?.focus();
      });
    });
  }

  protected onBackdropClick(): void {
    this.cancelled.emit();
  }

  protected onCancelClick(): void {
    this.cancelled.emit();
  }

  protected onConfirmClick(): void {
    const extendDays = this.form.get('extendDays')?.value ?? 30;
    if (extendDays >= 1) {
      this.confirm.emit({ extendDays });
    }
  }
}
