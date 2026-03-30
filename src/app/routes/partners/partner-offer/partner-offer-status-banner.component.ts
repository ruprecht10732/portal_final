import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

type PartnerOfferLayout = 'mobile' | 'desktop';
type PartnerOfferBannerVariant = 'accepted' | 'rejected' | 'inactive';

@Component({
  selector: 'app-partner-offer-status-banner',
  imports: [TranslatePipe],
  template: `
    @if (layout() === 'mobile') {
      <div class="px-5 pt-4">
        @if (variant() === 'accepted') {
          <div class="rounded-2xl border border-green-200 bg-green-50 px-4 py-3">
            <p class="text-sm font-semibold text-green-800">{{ 'partners.offer.success.thanks' | translate }}</p>
            <p class="mt-1 text-xs text-green-600">{{ 'partners.offer.success.accepted' | translate }}</p>
          </div>
        } @else if (variant() === 'rejected') {
          <div class="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
            <p class="text-sm font-semibold text-red-800">{{ 'partners.offer.success.rejected' | translate }}</p>
          </div>
        } @else {
          <div class="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
            <p class="text-sm font-semibold text-zinc-700">{{ statusLabelKey() | translate }}</p>
          </div>
        }
      </div>
    } @else {
      @if (variant() === 'accepted') {
        <div class="mb-6 rounded-xl border border-green-200 bg-green-50 p-4">
          <div class="flex items-center gap-3">
            <svg class="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
            <div>
              <p class="font-medium text-green-800">{{ 'partners.offer.success.thanks' | translate }}</p>
              <p class="text-sm text-green-600">{{ 'partners.offer.success.accepted' | translate }}</p>
            </div>
          </div>
        </div>
      } @else if (variant() === 'rejected') {
        <div class="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
          <div class="flex items-center gap-3">
            <svg class="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            <p class="font-medium text-red-800">{{ 'partners.offer.success.rejected' | translate }}</p>
          </div>
        </div>
      } @else {
        <div class="mb-6 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <div class="flex items-center gap-3">
            <svg class="h-5 w-5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <p class="font-medium text-zinc-700">{{ statusLabelKey() | translate }}</p>
          </div>
        </div>
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartnerOfferStatusBannerComponent {
  readonly layout = input<PartnerOfferLayout>('desktop');
  readonly variant = input.required<PartnerOfferBannerVariant>();
  readonly statusLabelKey = input('');
}