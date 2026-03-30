import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { MarkdownPipe } from '../../../shared/pipes/markdown.pipe';

@Component({
  selector: 'app-partner-offer-summary-card',
  imports: [TranslatePipe, MarkdownPipe],
  template: `
    @if (layout() === 'mobile') {
      <div class="flex items-center justify-between px-5 py-4">
        <div>
          <h3 class="text-xs font-extrabold uppercase tracking-[0.15em] text-slate-400">{{ 'partners.offer.fullSummaryTitle' | translate }}</h3>
          <p class="mt-1 text-sm text-zinc-500">{{ 'partners.offer.fullSummaryBody' | translate }}</p>
        </div>
      </div>
      <div class="mx-5 rounded-2xl bg-white p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)]">
        <div class="markdown-content summary-markdown prose prose-zinc max-w-none text-sm leading-relaxed text-zinc-700" [innerHTML]="summary() | markdown"></div>
      </div>
    } @else {
      <div class="rounded-xl bg-white p-6 shadow-sm">
        <div class="border-b border-zinc-100 pb-4">
          <h2 class="text-lg font-semibold text-zinc-900">{{ 'partners.offer.fullSummaryTitle' | translate }}</h2>
          <p class="mt-1 text-sm text-zinc-500">{{ 'partners.offer.fullSummaryBody' | translate }}</p>
        </div>
        <div class="markdown-content summary-markdown prose prose-zinc mt-4 max-w-none text-sm leading-relaxed text-zinc-700" [innerHTML]="summary() | markdown"></div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartnerOfferSummaryCardComponent {
  readonly layout = input<'mobile' | 'desktop'>('desktop');
  readonly summary = input.required<string>();
}