import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

type PhotoItem = {
  id: string;
  url: string;
  label: string;
};

@Component({
  selector: 'app-partner-offer-photos-card',
  imports: [TranslatePipe],
  template: `
    @if (layout() === 'mobile') {
      <div class="flex items-center justify-between px-5 py-4 mt-2">
        <h3 class="text-xs font-extrabold uppercase tracking-[0.15em] text-slate-400">{{ 'partners.offer.photosTitle' | translate }}</h3>
      </div>
      <div class="mx-5 rounded-2xl bg-white p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)]">
        <div class="grid grid-cols-2 gap-3">
          @for (photo of photos(); track photo.id) {
            <a [href]="photo.url" target="_blank" rel="noopener" class="block overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50">
              <img [src]="photo.url" [alt]="photo.label" class="h-32 w-full object-cover" loading="lazy" />
            </a>
          }
        </div>
      </div>
    } @else {
      <div class="rounded-xl bg-white p-6 shadow-sm">
        <div class="border-b border-zinc-100 pb-4">
          <h2 class="text-lg font-semibold text-zinc-900">{{ 'partners.offer.photosTitle' | translate }}</h2>
        </div>
        <div class="mt-4 grid grid-cols-2 gap-4">
          @for (photo of photos(); track photo.id) {
            <a [href]="photo.url" target="_blank" rel="noopener" class="block overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
              <img [src]="photo.url" [alt]="photo.label" class="h-40 w-full object-cover" loading="lazy" />
            </a>
          }
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartnerOfferPhotosCardComponent {
  readonly layout = input<'mobile' | 'desktop'>('desktop');
  readonly photos = input.required<readonly PhotoItem[]>();
}