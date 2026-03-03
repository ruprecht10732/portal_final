import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { OverlayModule } from '@angular/cdk/overlay';
import { ColorPickerModule } from '@iplab/ngx-color-picker';

@Component({
  selector: 'shared-color-picker',
  imports: [OverlayModule, ColorPickerModule],
  templateUrl: './color-picker.component.html',
  styleUrl: './color-picker.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ColorPickerComponent {
  value = model<string>('');
  label = input<string>('');
  placeholder = input('#3B82F6');
  ariaLabel = input<string | undefined>(undefined);
  disabled = input(false);
  required = input(false);
  hint = input<string>('');
  error = input<string>('');
  compact = input(false);

  protected readonly isOpen = signal(false);
  protected readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');

  protected readonly uid = 'color-picker-' + Math.random().toString(36).substring(2, 9);
  protected readonly hintId = this.uid + '-hint';
  protected readonly errorId = this.uid + '-error';

  protected readonly normalizedValue = computed(() => this.normalizeHex(this.value()));
  protected readonly displayValue = computed(() => this.normalizedValue() || '');
  protected readonly swatchColor = computed(() => this.normalizedValue() || 'transparent');

  protected describedBy(): string | undefined {
    const ids: string[] = [];
    if (this.error()) ids.push(this.errorId);
    if (this.hint()) ids.push(this.hintId);
    return ids.length ? ids.join(' ') : undefined;
  }

  protected toggle(): void {
    if (this.disabled()) return;
    this.isOpen.update(open => !open);
  }

  protected close(): void {
    this.isOpen.set(false);
  }

  protected onPickerColorChange(color: string): void {
    const normalized = this.normalizeHex(color);
    this.value.set(normalized);
  }

  protected onHexInputChange(raw: string): void {
    this.value.set(raw);
  }

  protected onHexBlur(): void {
    this.value.set(this.normalizeHex(this.value()));
  }

  protected clear(): void {
    if (this.disabled()) return;
    this.value.set('');
  }

  private normalizeHex(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value !== 'string') return '';

    const trimmed = value.trim();
    if (!trimmed) return '';

    let candidate = trimmed;
    if (!candidate.startsWith('#')) candidate = `#${candidate}`;

    // Expand short hex (#RGB -> #RRGGBB)
    const shortHexRegex = /^#([0-9a-fA-F]{3})$/;
    const shortMatch = shortHexRegex.exec(candidate);
    if (shortMatch?.[1]) {
      const r = shortMatch[1][0];
      const g = shortMatch[1][1];
      const b = shortMatch[1][2];
      if (r && g && b) {
        candidate = `#${r}${r}${g}${g}${b}${b}`;
      }
    }

    if (!/^#[0-9a-fA-F]{6}$/.test(candidate)) return '';
    return candidate.toUpperCase();
  }
}
