import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import type { AnnotationResponse } from '../../../core/services/quotes.types';

@Component({
  selector: 'app-quote-annotation-list',
  templateUrl: './quote-annotation-list.component.html',
  styleUrl: './quote-annotation-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuoteAnnotationListComponent {
  readonly annotations = input<AnnotationResponse[]>([]);
  readonly canEdit = input(false);
  readonly lockEdits = input(false);
  readonly deletingId = input<string | null>(null);
  readonly variant = input<'mobile' | 'desktop'>('mobile');

  readonly edit = output<AnnotationResponse>();
  readonly remove = output<AnnotationResponse>();

  protected readonly listClass = computed(() =>
    this.variant() === 'mobile' ? 'flex flex-col gap-3' : 'space-y-2',
  );
}
