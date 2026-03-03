import { Component, input, ChangeDetectionStrategy, computed } from '@angular/core';

export type ChipVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

@Component({
  selector: 'shared-chip',
  standalone: true,
  imports: [],
  template: `
    <span
      class="inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border rounded-xs"
      [class]="variantClasses()"
    >
      <ng-content />
    </span>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChipComponent {
  variant = input<ChipVariant>('default');

  protected variantClasses = computed(() => {
    switch (this.variant()) {
      case 'success':
        return 'bg-green-50 text-green-700 border-green-100 dark:bg-green-950/30 dark:text-green-400 dark:border-green-900/50';
      case 'warning':
        return 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50';
      case 'danger':
        return 'bg-red-50 text-red-700 border-red-100 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/50';
      case 'info':
        return 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/50';
      case 'neutral':
        return 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700';
      default:
        return 'bg-white text-zinc-900 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-800';
    }
  });
}
