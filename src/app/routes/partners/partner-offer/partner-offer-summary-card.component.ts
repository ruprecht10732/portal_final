import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-partner-offer-summary-card',
  imports: [TranslatePipe],
  template: `
    @if (layout() === 'mobile') {
      <div class="flex items-center justify-between px-5 py-4">
        <div>
          <h3 class="text-xs font-extrabold uppercase tracking-[0.15em] text-slate-400">{{ 'partners.offer.summaryTitle' | translate }}</h3>
          <p class="mt-1 text-sm text-zinc-500">{{ 'partners.offer.summaryBody' | translate }}</p>
        </div>
      </div>
      <div class="mx-5 rounded-2xl bg-white p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)]">
        @if (headline()) {
          <h2 class="text-lg font-extrabold leading-tight text-slate-900">{{ headline() }}</h2>
        }
        @if (intro()) {
          <p class="mt-3 text-sm leading-7 text-zinc-700">{{ intro() }}</p>
        }

        @if (workItems().length > 0) {
          <div class="mt-5 border-t border-zinc-100 pt-5">
            <h3 class="text-xs font-extrabold uppercase tracking-[0.15em] text-slate-400">{{ 'partners.offer.workItemsTitle' | translate }}</h3>
            <div class="mt-3 space-y-3">
              @for (item of workItems(); track item) {
                <div class="rounded-2xl bg-slate-50 px-4 py-3">
                  <p class="text-sm font-medium leading-6 text-slate-800">{{ item }}</p>
                </div>
              }
            </div>
          </div>
        }

        @if (attentionPoints().length > 0) {
          <div class="mt-5 border-t border-zinc-100 pt-5">
            <h3 class="text-xs font-extrabold uppercase tracking-[0.15em] text-slate-400">{{ 'partners.offer.attentionHeading' | translate }}</h3>
            <div class="mt-3 space-y-3">
              @for (point of attentionPoints(); track point) {
                <div class="flex gap-3 rounded-2xl bg-amber-50 px-4 py-3">
                  <span class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500"></span>
                  <p class="text-sm leading-6 text-amber-950">{{ point }}</p>
                </div>
              }
            </div>
          </div>
        }
      </div>
    } @else {
      <div class="rounded-xl bg-white p-6 shadow-sm">
        <div class="border-b border-zinc-100 pb-4">
          <h2 class="text-lg font-semibold text-zinc-900">{{ 'partners.offer.summaryTitle' | translate }}</h2>
          <p class="mt-1 text-sm text-zinc-500">{{ 'partners.offer.summaryBody' | translate }}</p>
        </div>
        @if (headline()) {
          <h3 class="mt-4 text-xl font-extrabold leading-tight text-slate-900">{{ headline() }}</h3>
        }
        @if (intro()) {
          <p class="mt-3 text-sm leading-7 text-zinc-700">{{ intro() }}</p>
        }

        @if (workItems().length > 0) {
          <div class="mt-5 border-t border-zinc-100 pt-5">
            <h3 class="text-xs font-extrabold uppercase tracking-[0.15em] text-slate-400">{{ 'partners.offer.workItemsTitle' | translate }}</h3>
            <div class="mt-3 grid gap-3">
              @for (item of workItems(); track item) {
                <div class="rounded-2xl bg-slate-50 px-4 py-4">
                  <p class="text-sm font-medium leading-6 text-slate-900">{{ item }}</p>
                </div>
              }
            </div>
          </div>
        }

        @if (attentionPoints().length > 0) {
          <div class="mt-5 border-t border-zinc-100 pt-5">
            <h3 class="text-xs font-extrabold uppercase tracking-[0.15em] text-slate-400">{{ 'partners.offer.attentionHeading' | translate }}</h3>
            <div class="mt-3 space-y-3">
              @for (point of attentionPoints(); track point) {
                <div class="flex gap-3 rounded-2xl bg-amber-50 px-4 py-4">
                  <span class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500"></span>
                  <p class="text-sm leading-6 text-amber-950">{{ point }}</p>
                </div>
              }
            </div>
          </div>
        }
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartnerOfferSummaryCardComponent {
  readonly layout = input<'mobile' | 'desktop'>('desktop');
  readonly headline = input('');
  readonly intro = input('');
  readonly workItems = input<readonly string[]>([]);
  readonly attentionPoints = input<readonly string[]>([]);
}