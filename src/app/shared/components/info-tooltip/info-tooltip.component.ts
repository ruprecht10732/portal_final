import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'shared-info-tooltip',
  standalone: true,
  template: `
    <span class="relative inline-flex items-center group cursor-help ml-1">
      <svg
        class="h-3.5 w-3.5 text-zinc-400 hover:text-zinc-600 transition-colors"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" stroke-width="2" />
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 16v-4m0-4h.01" />
      </svg>
      <span
        class="pointer-events-none absolute z-50 w-48 rounded bg-zinc-800 px-2 py-1.5 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 shadow-lg"
        [class.bottom-full]="position() === 'top'"
        [class.mb-1]="position() === 'top'"
        [class.top-full]="position() === 'bottom'"
        [class.mt-1]="position() === 'bottom'"
        [class.left-1/2]="position() === 'top' || position() === 'bottom'"
        [class.-translate-x-1/2]="position() === 'top' || position() === 'bottom'"
        [class.left-full]="position() === 'right'"
        [class.ml-1]="position() === 'right'"
        role="tooltip"
      >
        {{ text() }}
      </span>
      <span class="sr-only">{{ text() }}</span>
    </span>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InfoTooltipComponent {
  text = input.required<string>();
  position = input<'top' | 'bottom' | 'right'>('right');
}
