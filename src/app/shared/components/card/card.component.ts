import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

type CardPadding = 'none' | 'compact' | 'default' | 'spacious';
type CardVariant = 'default' | 'elevated' | 'interactive';

@Component({
  selector: 'shared-card',
  templateUrl: './card.component.html',
  styleUrl: './card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'containerClass()',
    '[attr.tabindex]': 'variant() === "interactive" ? 0 : null',
  },
})
export class CardComponent {
  padding = input<CardPadding>('default');
  variant = input<CardVariant>('default');
  className = input('');

  protected readonly paddingClass = computed(() => {
    switch (this.padding()) {
      case 'none':
        return '';
      case 'compact':
        return 'p-3 sm:p-4';
      case 'spacious':
        return 'p-5 sm:p-6 lg:p-7';
      default:
        return 'p-4 sm:p-5 lg:p-6';
    }
  });

  protected readonly containerClass = computed(() => {
    const classes = [
      'bg-white',
      'border',
      'border-zinc-200',
      'rounded-xl',
      this.paddingClass(),
      this.variant(),
      this.className(),
    ].filter(Boolean);
    return classes.join(' ');
  });
}
