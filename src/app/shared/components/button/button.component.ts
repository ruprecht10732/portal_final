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
  [attr.data-variant]="variant()"
  [attr.data-size]="size()"
  [attr.data-shape]="shape()"
  [attr.data-icon-only]="iconOnly()"
  [attr.data-loading]="loading()"
  [attr.data-stacked]="stacked()"
  [attr.data-full-width]="fullWidth()"
  (click)="!loading() && clicked.emit($event)"
  class="relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-lg transition-all duration-200 ease-out cursor-pointer touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-11 min-w-11 md:min-h-0 md:min-w-0 data-[variant=primary]:bg-zinc-900 data-[variant=primary]:text-white data-[variant=primary]:shadow-sm data-[variant=primary]:hover:bg-zinc-800 data-[variant=primary]:active:scale-[0.98] data-[variant=secondary]:bg-white data-[variant=secondary]:text-zinc-900 data-[variant=secondary]:ring-1 data-[variant=secondary]:ring-inset data-[variant=secondary]:ring-zinc-200 data-[variant=secondary]:hover:bg-zinc-50 data-[variant=secondary]:active:scale-[0.98] data-[variant=ghost]:bg-transparent data-[variant=ghost]:text-zinc-600 data-[variant=ghost]:hover:bg-zinc-100 data-[variant=ghost]:hover:text-zinc-900 data-[variant=ghost]:active:scale-[0.98] data-[variant=ghost]:active:bg-zinc-200 data-[variant=danger]:bg-red-600 data-[variant=danger]:text-white data-[variant=danger]:hover:bg-red-700 data-[variant=danger]:shadow-sm data-[size=default]:px-4 data-[size=default]:py-2.5 data-[size=default]:text-base data-[size=default]:font-medium md:data-[size=default]:px-4 md:data-[size=default]:py-2 md:data-[size=default]:text-sm data-[size=compact]:px-3 data-[size=compact]:py-2 data-[size=compact]:text-sm data-[size=compact]:font-medium md:data-[size=compact]:text-xs md:data-[size=compact]:py-1.5 data-[icon-only=true]:p-0 data-[icon-only=true]:w-11 md:data-[icon-only=true]:w-auto md:data-[icon-only=true]:px-0 data-[shape=square]:aspect-square md:data-[shape=square]:h-10 md:data-[shape=square]:w-10 data-[shape=round]:rounded-full data-[shape=round]:overflow-visible data-[shape=round]:bg-transparent data-[shape=round]:p-0 data-[stacked=true]:flex-col data-[stacked=true]:gap-1 data-[stacked=true]:h-auto data-[stacked=true]:py-4 data-[full-width=true]:w-full"
>
  @if (loading()) {
    <div class="absolute inset-0 z-10 flex items-center justify-center bg-inherit rounded-[inherit]">
      <svg class="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    </div>
  }

  <span 
    class="inline-flex items-center gap-2 transition-opacity duration-200"
    [class.opacity-0]="loading()"
    [class.flex-col]="stacked()"
  >
    <ng-content></ng-content>
  </span>

  @if (tooltip()) {
    <div class="group absolute inset-0">
      <span class="sr-only">{{ tooltip() }}</span>
      <div class="hidden md:group-hover:block absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50">
        <div class="relative whitespace-nowrap rounded bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-xl animate-in fade-in slide-in-from-left-2 duration-200">
          {{ tooltip() }}
          <div class="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2 rotate-45 bg-zinc-900"></div>
        </div>
      </div>
    </div>
  }
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
  shape = input<'default' | 'square' | 'round'>('default');
  active = input(false);
  stacked = input(false);
  uppercase = input(true);
  ariaLabel = input<string | undefined>(undefined);
  ariaExpanded = input<string | boolean | null | undefined>(undefined);
  ariaControls = input<string | null | undefined>(undefined);
  ariaHaspopup = input<string | boolean | null | undefined>(undefined);
  tooltip = input<string | undefined>(undefined);
  clicked = output<MouseEvent>();
}
