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
      (click)="!loading() && clicked.emit($event)"
      class="relative flex items-center justify-center w-full px-6 py-3 text-sm font-medium tracking-tight uppercase transition-all duration-200 sm:w-auto overflow-hidden"
      [class.bg-black]="variant() === 'primary'"
      [class.text-white]="variant() === 'primary'"
      [class.hover:bg-zinc-800]="variant() === 'primary'"
      [class.bg-white]="variant() === 'secondary'"
      [class.text-black]="variant() === 'secondary'"
      [class.hover:bg-zinc-100]="variant() === 'secondary'"
      [class.border]="variant() === 'secondary'"
      [class.border-black]="variant() === 'secondary'"
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
      <span [class.opacity-0]="loading()">
        <ng-content />
      </span>
    </button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: inline-block;
      width: 100%;
    }
    @media (min-width: 640px) {
      :host {
        width: auto;
      }
    }
  `,
})
export class ButtonComponent {
  variant = input<'primary' | 'secondary'>('primary');
  type = input<'button' | 'submit' | 'reset'>('button');
  disabled = input(false);
  loading = input(false);
  ariaLabel = input<string | undefined>(undefined);
  clicked = output<MouseEvent>();
}
