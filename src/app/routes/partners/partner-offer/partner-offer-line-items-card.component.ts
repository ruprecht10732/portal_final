import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { SafeHtmlPipe } from '../../../shared/pipes/safe-html.pipe';

type LineItem = {
  description: string;
  quantity: string;
};

@Component({
  selector: 'app-partner-offer-line-items-card',
  imports: [TranslatePipe, SafeHtmlPipe],
  template: `
    @if (layout() === 'mobile') {
      <div class="flex items-center justify-between px-5 py-4 mt-2">
        <h3 class="text-xs font-extrabold uppercase tracking-[0.15em] text-slate-400">{{ 'partners.offer.lineItemsTitle' | translate }}</h3>
      </div>
      <div class="mx-5 rounded-2xl bg-white p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)]">
        <div class="space-y-3">
          @for (item of items(); track item.description + item.quantity) {
            <div class="rounded-2xl border border-zinc-200 px-4 py-3">
              <div class="prose prose-sm prose-zinc max-w-none break-words text-zinc-900 prose-p:my-0 prose-ul:my-0 prose-ol:my-0 prose-blockquote:my-0 prose-pre:my-0 prose-li:my-1 prose-a:text-blue-600 prose-strong:text-zinc-900 prose-strong:font-semibold" [innerHTML]="item.description | safeHtml"></div>
              <p class="mt-1 text-xs text-zinc-500">{{ item.quantity }}</p>
            </div>
          }
        </div>
      </div>
    } @else {
      <div class="rounded-xl bg-white p-6 shadow-sm">
        <div class="border-b border-zinc-100 pb-4">
          <h2 class="text-lg font-semibold text-zinc-900">{{ 'partners.offer.lineItemsTitle' | translate }}</h2>
        </div>
        <div class="mt-4 space-y-3">
          @for (item of items(); track item.description + item.quantity) {
            <div class="rounded-xl border border-zinc-200 px-4 py-3">
              <div class="prose prose-sm prose-zinc max-w-none break-words text-zinc-900 prose-p:my-0 prose-ul:my-0 prose-ol:my-0 prose-blockquote:my-0 prose-pre:my-0 prose-li:my-1 prose-a:text-blue-600 prose-strong:text-zinc-900 prose-strong:font-semibold" [innerHTML]="item.description | safeHtml"></div>
              <p class="mt-1 text-xs text-zinc-500">{{ item.quantity }}</p>
            </div>
          }
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartnerOfferLineItemsCardComponent {
  readonly layout = input<'mobile' | 'desktop'>('desktop');
  readonly items = input.required<readonly LineItem[]>();
}