import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { type PublicPartnerOfferLeadContact } from '../../../core/services/partner-offer.types';

type PartnerOfferLayout = 'mobile' | 'desktop';

@Component({
  selector: 'app-partner-offer-confirmation-card',
  imports: [TranslatePipe],
  template: `
    @if (layout() === 'mobile') {
      <div class="px-5 pt-4">
        <div class="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)]">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="text-xs font-bold uppercase tracking-[0.15em] text-zinc-400">{{ 'partners.offer.confirmation.title' | translate }}</p>
              <h3 class="mt-1 text-base font-bold text-zinc-900">{{ 'partners.offer.confirmation.leadContactTitle' | translate }}</h3>
            </div>
            @if (pdfReady() && pdfDownloadUrl(); as url) {
              <a [href]="url" download class="inline-flex min-h-11 items-center justify-center rounded-xl bg-zinc-900 px-4 py-2 text-xs font-bold text-white">
                {{ 'partners.offer.confirmation.downloadPdf' | translate }}
              </a>
            }
          </div>

          <div class="mt-4 grid grid-cols-1 gap-3 text-sm">
            <div class="rounded-xl bg-zinc-50 px-4 py-3">
              <p class="text-[11px] font-bold uppercase tracking-widest text-zinc-400">{{ 'partners.offer.confirmation.name' | translate }}</p>
              <p class="mt-1 font-semibold text-zinc-900">{{ contact().name || '—' }}</p>
            </div>
            <div class="rounded-xl bg-zinc-50 px-4 py-3">
              <p class="text-[11px] font-bold uppercase tracking-widest text-zinc-400">{{ 'partners.offer.confirmation.phone' | translate }}</p>
              <p class="mt-1 font-semibold text-zinc-900">{{ contact().phone || '—' }}</p>
            </div>
            <div class="rounded-xl bg-zinc-50 px-4 py-3">
              <p class="text-[11px] font-bold uppercase tracking-widest text-zinc-400">{{ 'partners.offer.confirmation.email' | translate }}</p>
              <p class="mt-1 break-all font-semibold text-zinc-900">{{ contact().email || '—' }}</p>
            </div>
            <div class="rounded-xl bg-zinc-50 px-4 py-3">
              <p class="text-[11px] font-bold uppercase tracking-widest text-zinc-400">{{ 'partners.offer.confirmation.address' | translate }}</p>
              <p class="mt-1 font-semibold text-zinc-900">{{ contact().address || '—' }}</p>
            </div>
          </div>

          <div class="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs text-zinc-600">
            @if (pdfWaiting()) {
              <div class="flex items-center gap-2">
                <div class="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700"></div>
                <span>{{ 'partners.offer.confirmation.pdfPreparing' | translate }}</span>
              </div>
            } @else if (pdfReady()) {
              {{ 'partners.offer.confirmation.pdfReady' | translate }}
            } @else if (pdfError()) {
              <div class="flex items-center justify-between gap-3">
                <span>{{ 'partners.offer.confirmation.pdfRetry' | translate }}</span>
                <button type="button" class="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 font-semibold text-zinc-700" (click)="retry.emit()">
                  {{ 'partners.offer.confirmation.retry' | translate }}
                </button>
              </div>
            }
          </div>
        </div>
      </div>
    } @else {
      <div class="mb-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div class="flex flex-col gap-4 border-b border-zinc-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p class="text-xs font-bold uppercase tracking-widest text-zinc-400">{{ 'partners.offer.confirmation.title' | translate }}</p>
            <h2 class="mt-1 text-xl font-semibold text-zinc-900">{{ 'partners.offer.confirmation.leadContactTitle' | translate }}</h2>
            <p class="mt-1 text-sm text-zinc-500">{{ 'partners.offer.confirmation.subtitle' | translate }}</p>
          </div>
          @if (pdfReady() && pdfDownloadUrl(); as url) {
            <a [href]="url" download class="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-zinc-800">
              {{ 'partners.offer.confirmation.downloadPdf' | translate }}
            </a>
          }
        </div>

        <div class="mt-4 grid gap-4 sm:grid-cols-2">
          <div class="rounded-xl bg-zinc-50 px-4 py-4">
            <p class="text-xs font-bold uppercase tracking-widest text-zinc-400">{{ 'partners.offer.confirmation.name' | translate }}</p>
            <p class="mt-2 text-sm font-semibold text-zinc-900">{{ contact().name || '—' }}</p>
          </div>
          <div class="rounded-xl bg-zinc-50 px-4 py-4">
            <p class="text-xs font-bold uppercase tracking-widest text-zinc-400">{{ 'partners.offer.confirmation.phone' | translate }}</p>
            <p class="mt-2 text-sm font-semibold text-zinc-900">{{ contact().phone || '—' }}</p>
          </div>
          <div class="rounded-xl bg-zinc-50 px-4 py-4">
            <p class="text-xs font-bold uppercase tracking-widest text-zinc-400">{{ 'partners.offer.confirmation.email' | translate }}</p>
            <p class="mt-2 break-all text-sm font-semibold text-zinc-900">{{ contact().email || '—' }}</p>
          </div>
          <div class="rounded-xl bg-zinc-50 px-4 py-4">
            <p class="text-xs font-bold uppercase tracking-widest text-zinc-400">{{ 'partners.offer.confirmation.address' | translate }}</p>
            <p class="mt-2 text-sm font-semibold text-zinc-900">{{ contact().address || '—' }}</p>
          </div>
        </div>

        <div class="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm text-zinc-600">
          @if (pdfWaiting()) {
            <div class="flex items-center gap-3">
              <div class="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700"></div>
              <span>{{ 'partners.offer.confirmation.pdfPreparing' | translate }}</span>
            </div>
          } @else if (pdfReady()) {
            {{ 'partners.offer.confirmation.pdfReady' | translate }}
          } @else if (pdfError()) {
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>{{ 'partners.offer.confirmation.pdfRetry' | translate }}</span>
              <button type="button" class="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-100" (click)="retry.emit()">
                {{ 'partners.offer.confirmation.retry' | translate }}
              </button>
            </div>
          }
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartnerOfferConfirmationCardComponent {
  readonly layout = input<PartnerOfferLayout>('desktop');
  readonly contact = input.required<PublicPartnerOfferLeadContact>();
  readonly pdfReady = input(false);
  readonly pdfWaiting = input(false);
  readonly pdfError = input(false);
  readonly pdfDownloadUrl = input<string | null>(null);
  readonly retry = output<void>();
}