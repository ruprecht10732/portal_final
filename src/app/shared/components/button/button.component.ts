import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'shared-button',
  standalone: true,
  imports: [],
  template: `
    <button
      [type]="type()"
      [disabled]="disabled() || loading()"
      [attr.aria-label]="ariaLabel()"
      [attr.aria-disabled]="disabled() || loading()"
      [attr.aria-busy]="loading()"
      [attr.aria-expanded]="ariaExpanded()"
      [attr.aria-controls]="ariaControls()"
      [attr.aria-haspopup]="ariaHaspopup()"
      (click)="!loading() && clicked.emit($event)"
      class="relative flex items-center justify-center gap-2 transition-all duration-200 overflow-hidden cursor-pointer"
      [class.gap-0]="iconOnly()"
      [class.gap-1]="stacked()"
      [class.flex-col]="stacked()"
      [class.uppercase]="uppercase()"
      [class.normal-case]="!uppercase()"
      [class.px-6]="size() === 'default' && !iconOnly()"
      [class.py-3]="size() === 'default' && !iconOnly()"
      [class.text-sm]="size() === 'default' && !iconOnly()"
      [class.min-h-11]="size() === 'default' && !iconOnly()"
      [class.font-medium]="size() === 'default' && !iconOnly()"
      [class.tracking-tight]="size() === 'default' && !iconOnly()"
      [class.px-3]="size() === 'compact' && !iconOnly()"
      [class.py-2]="size() === 'compact' && !iconOnly()"
      [class.text-xs]="size() === 'compact' && !iconOnly()"
      [class.font-semibold]="size() === 'compact' && !iconOnly()"
      [class.tracking-wide]="size() === 'compact' && !iconOnly()"
      [class.min-h-11]="size() === 'compact' && !iconOnly()"
      [class.h-11]="iconOnly() && (shape() === 'square' || size() === 'default')"
      [class.w-11]="iconOnly() && (shape() === 'square' || size() === 'default')"
      [class.min-h-11]="iconOnly() && shape() === 'square'"
      [class.min-w-11]="iconOnly() && shape() === 'square'"
      [class.h-10]="iconOnly() && size() === 'compact' && shape() !== 'square'"
      [class.w-10]="iconOnly() && size() === 'compact' && shape() !== 'square'"
      [class.p-0]="iconOnly()"
      [class.leading-none]="iconOnly()"
      [class.w-full]="fullWidth()"
      [class.sm:w-auto]="fullWidth()"
      [class.w-auto]="!fullWidth()"
      [class.bg-black]="variant() === 'primary'"
      [class.text-white]="variant() === 'primary'"
      [class.hover:bg-zinc-800]="variant() === 'primary'"
      [class.bg-white]="variant() === 'secondary'"
      [class.text-black]="variant() === 'secondary'"
      [class.hover:bg-zinc-100]="variant() === 'secondary'"
      [class.border]="variant() === 'secondary'"
      [class.border-black]="variant() === 'secondary'"
      [class.bg-green-700]="variant() === 'success'"
      [class.text-white]="variant() === 'success'"
      [class.hover:bg-green-800]="variant() === 'success'"
      [class.bg-red-700]="variant() === 'danger'"
      [class.text-white]="variant() === 'danger'"
      [class.hover:bg-red-800]="variant() === 'danger'"
      [class.text-zinc-500]="variant() === 'ghost' && !active()"
      [class.text-black]="variant() === 'ghost' && active()"
      [class.hover:text-black]="variant() === 'ghost'"
      [class.bg-zinc-200]="variant() === 'ghost' && active()"
      [class.opacity-50]="disabled() || loading()"
      [class.cursor-not-allowed]="disabled() || loading()"
    >
      @if (loading()) {
        <div class="absolute inset-0 flex items-center justify-center bg-inherit">
          <svg class="w-5 h-5 animate-spin" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span class="sr-only">Loading...</span>
        </div>
      }
      <span
        class="inline-flex items-center gap-2 whitespace-nowrap"
        [class.opacity-0]="loading()"
        [class.flex-col]="stacked()"
        [class.items-center]="stacked()"
        [class.text-center]="stacked()"
        [class.gap-1]="stacked()"
        [class.gap-0]="iconOnly()"
        [class.text-white]="variant() === 'primary' || variant() === 'success' || variant() === 'danger'"
      >
        <ng-content />
      </span>
    </button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.display]': "'inline-block'",
  },
})
export class ButtonComponent {
  variant = input<'primary' | 'secondary' | 'ghost' | 'success' | 'danger'>('primary');
  size = input<'default' | 'compact'>('default');
  type = input<'button' | 'submit' | 'reset'>('button');
  disabled = input(false);
  loading = input(false);
  fullWidth = input(true);
  iconOnly = input(false);
  shape = input<'default' | 'square'>('default');
  active = input(false);
  stacked = input(false);
  uppercase = input(true);
  ariaLabel = input<string | undefined>(undefined);
  ariaExpanded = input<string | boolean | null | undefined>(undefined);
  ariaControls = input<string | null | undefined>(undefined);
  ariaHaspopup = input<string | boolean | null | undefined>(undefined);
  clicked = output<MouseEvent>();
}
