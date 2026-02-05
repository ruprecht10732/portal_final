import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'shared-skeleton',
  template: `
    <div 
      class="animate-pulse bg-zinc-200 rounded"
      [class.rounded-full]="variant() === 'circle'"
      [class.rounded-lg]="variant() === 'rectangle'"
      [style.width]="width()"
      [style.height]="height()"
      aria-hidden="true"
    ></div>
  `,
  styles: [`
    :host {
      display: inline-block;
    }
    
    @media (prefers-reduced-motion: reduce) {
      .animate-pulse {
        animation: none;
        background: linear-gradient(90deg, #e4e4e7 25%, #f4f4f5 50%, #e4e4e7 75%);
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SkeletonComponent {
  width = input('100%');
  height = input('1rem');
  variant = input<'rectangle' | 'circle'>('rectangle');
}
