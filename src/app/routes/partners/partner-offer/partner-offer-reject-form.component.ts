import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

type PartnerOfferLayout = 'mobile' | 'desktop';

@Component({
  selector: 'app-partner-offer-reject-form',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    @if (layout() === 'mobile') {
      <div class="px-6 pb-6 pt-4">
        <p class="text-sm text-zinc-500">{{ 'partners.offer.reject.placeholder' | translate }}</p>
        <div class="mt-4">
          <label for="reject-reason-mobile" class="block text-xs font-bold uppercase tracking-widest text-zinc-400">{{ 'partners.offer.reject.reasonLabel' | translate }}</label>
          <textarea
            id="reject-reason-mobile"
            rows="3"
            maxlength="500"
            class="mt-2 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
            [value]="reason()"
            (input)="reasonUpdated.emit(($any($event.target).value ?? '').toString())"
          ></textarea>
        </div>
      </div>

      <div class="border-t border-zinc-100 bg-white/90 px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4 backdrop-blur">
        <div class="flex flex-col gap-3">
          <button type="button" class="h-14 w-full rounded-[18px] bg-red-600 text-base font-extrabold text-white shadow-lg shadow-red-500/20 transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50" (click)="submitRequested.emit()" [disabled]="rejecting()">
            @if (rejecting()) {
              <span class="flex items-center justify-center gap-2">
                <div class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                {{ 'partners.offer.actions.busy' | translate }}
              </span>
            } @else {
              {{ 'partners.offer.actions.confirmReject' | translate }}
            }
          </button>
          <button type="button" class="h-12 w-full rounded-[18px] border border-zinc-200 text-sm font-semibold text-zinc-500" (click)="cancelRequested.emit()" [disabled]="rejecting()">
            {{ 'partners.offer.actions.cancel' | translate }}
          </button>
        </div>
      </div>
    } @else {
      <div class="mt-6 overflow-hidden rounded-xl bg-white shadow-sm">
        <div class="border-b border-zinc-100 px-6 py-4">
          <h2 class="text-lg font-semibold text-zinc-900">{{ 'partners.offer.reject.title' | translate }}</h2>
        </div>
        <div class="p-6">
          <label for="reject-reason-desktop" class="block text-xs font-bold uppercase tracking-widest text-zinc-400">{{ 'partners.offer.reject.reasonLabel' | translate }}</label>
          <textarea
            id="reject-reason-desktop"
            rows="3"
            maxlength="500"
            class="mt-2 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
            [value]="reason()"
            (input)="reasonUpdated.emit(($any($event.target).value ?? '').toString())"
            [placeholder]="'partners.offer.reject.placeholder' | translate"
          ></textarea>
          <div class="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button type="button" class="rounded-xl border border-zinc-200 bg-white px-6 py-3 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50" (click)="cancelRequested.emit()" [disabled]="rejecting()">
              {{ 'partners.offer.actions.cancel' | translate }}
            </button>
            <button type="button" class="rounded-xl bg-red-600 px-8 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50" (click)="submitRequested.emit()" [disabled]="rejecting()">
              @if (rejecting()) {
                {{ 'partners.offer.actions.busy' | translate }}
              } @else {
                {{ 'partners.offer.actions.confirmReject' | translate }}
              }
            </button>
          </div>
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartnerOfferRejectFormComponent {
  readonly layout = input<PartnerOfferLayout>('desktop');
  readonly reason = input('');
  readonly rejecting = input(false);

  readonly reasonUpdated = output<string>();
  readonly cancelRequested = output<void>();
  readonly submitRequested = output<void>();
}