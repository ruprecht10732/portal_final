import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';

import type { AnnotationResponse } from '../../../core/services/quotes.types';

@Component({
  selector: 'app-quote-annotation-list',
  standalone: true,
  imports: [DatePipe, LucideAngularModule],
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
  readonly organizationName = input<string>('');

  readonly requestEdit = output<AnnotationResponse>();
  readonly requestRemove = output<AnnotationResponse>();

  protected readonly listClass = computed(() =>
    this.variant() === 'mobile' ? 'flex flex-col gap-4' : 'space-y-3',
  );
}
