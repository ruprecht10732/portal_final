import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

type PartnerOfferLayout = 'mobile' | 'desktop';

@Component({
  selector: 'app-partner-offer-actions',
  imports: [TranslatePipe],
  template: `
    @if (layout() === 'mobile') {
      <div class="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-100 bg-white/80 px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-5 backdrop-blur">
        <div class="mx-auto flex max-w-md flex-col gap-3">
          <button type="button" class="flex h-16 w-full items-center justify-center gap-2 rounded-[20px] bg-teal-600 text-lg font-extrabold text-white shadow-xl shadow-teal-500/25 transition-all active:scale-[0.97] active:bg-teal-700" (click)="accept.emit()">
            <span>{{ 'partners.offer.actions.accept' | translate }}</span>
          </button>
          <button type="button" class="h-14 w-full rounded-[20px] border-2 border-slate-100 text-base font-bold text-slate-400 transition-all active:scale-[0.97]" (click)="reject.emit()">
            {{ 'partners.offer.actions.reject' | translate }}
          </button>
        </div>
      </div>
    } @else {
      <div class="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <button type="button" class="rounded-xl border border-red-200 bg-white px-6 py-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-50" (click)="reject.emit()">
          {{ 'partners.offer.actions.reject' | translate }}
        </button>
        <button type="button" class="rounded-xl bg-teal-600 px-8 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-teal-700" (click)="accept.emit()">
          {{ 'partners.offer.actions.accept' | translate }}
        </button>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartnerOfferActionsComponent {
  readonly layout = input<PartnerOfferLayout>('desktop');
  readonly accept = output<void>();
  readonly reject = output<void>();
}