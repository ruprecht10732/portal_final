import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-partner-offer-loading-skeleton',
  template: `
    <div class="min-h-screen bg-linear-to-br from-zinc-50 to-zinc-100">
      <div class="mx-auto max-w-4xl px-0 pb-8 pt-0 sm:px-6 sm:py-8 lg:px-8">
        <div class="sm:hidden">
          <div class="sticky top-0 z-30 grid grid-cols-[40px_1fr_40px] items-center border-b border-gray-100 bg-white/80 px-4 py-4 backdrop-blur">
            <div class="h-8 w-8 rounded-full bg-zinc-200"></div>
            <div class="mx-auto h-3 w-28 rounded-full bg-zinc-200"></div>
            <div class="h-8 w-8 rounded-full bg-zinc-200"></div>
          </div>

          <div class="animate-pulse space-y-4 pb-10">
            <div class="border-b border-gray-100 bg-white px-5 pb-6 pt-6">
              <div class="overflow-hidden rounded-[28px] bg-slate-950 p-5">
                <div class="h-1.5 w-full rounded-full bg-white/10"></div>
                <div class="mt-5 flex items-start justify-between gap-4">
                  <div class="min-w-0 flex-1 space-y-3">
                    <div class="h-3 w-28 rounded-full bg-white/15"></div>
                    <div class="h-7 w-full rounded-full bg-white/20"></div>
                    <div class="h-7 w-5/6 rounded-full bg-white/20"></div>
                    <div class="h-4 w-full rounded-full bg-white/10"></div>
                    <div class="h-4 w-4/5 rounded-full bg-white/10"></div>
                  </div>
                  <div class="h-24 w-28 shrink-0 rounded-2xl bg-white/10"></div>
                </div>
                <div class="mt-5 flex gap-2">
                  <div class="h-8 w-24 rounded-full bg-white/10"></div>
                  <div class="h-8 w-20 rounded-full bg-white/10"></div>
                </div>
                <div class="mt-5 grid gap-3">
                  <div class="h-20 rounded-2xl bg-white/8"></div>
                  <div class="h-20 rounded-2xl bg-white/8"></div>
                  <div class="h-20 rounded-2xl bg-white/8"></div>
                </div>
              </div>
            </div>

            <div class="mx-5 rounded-2xl bg-white p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)]">
              <div class="h-3 w-32 rounded-full bg-zinc-200"></div>
              <div class="mt-4 h-6 w-3/4 rounded-full bg-zinc-200"></div>
              <div class="mt-3 h-4 w-full rounded-full bg-zinc-100"></div>
              <div class="mt-2 h-4 w-5/6 rounded-full bg-zinc-100"></div>
              <div class="mt-5 space-y-3 border-t border-zinc-100 pt-5">
                <div class="h-16 rounded-2xl bg-slate-50"></div>
                <div class="h-16 rounded-2xl bg-slate-50"></div>
              </div>
            </div>

            <div class="mx-5 rounded-2xl bg-white p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)]">
              <div class="grid grid-cols-2 gap-3">
                <div class="h-32 rounded-2xl bg-zinc-200"></div>
                <div class="h-32 rounded-2xl bg-zinc-200"></div>
              </div>
            </div>

            <div class="mx-5 rounded-2xl bg-white p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)]">
              <div class="h-40 rounded-2xl bg-zinc-200"></div>
              <div class="mt-3 h-3 w-2/3 rounded-full bg-zinc-100"></div>
            </div>
          </div>
        </div>

        <div class="hidden animate-pulse sm:block">
          <div class="overflow-hidden rounded-[28px] bg-white shadow-[0_16px_40px_-24px_rgba(15,23,42,0.35)] ring-1 ring-slate-200">
            <div class="h-1.5 w-full bg-zinc-200"></div>
            <div class="p-7">
              <div class="flex items-start justify-between gap-6">
                <div class="flex-1 space-y-4">
                  <div class="h-3 w-32 rounded-full bg-zinc-200"></div>
                  <div class="h-9 w-4/5 rounded-full bg-zinc-200"></div>
                  <div class="h-5 w-full rounded-full bg-zinc-100"></div>
                  <div class="h-5 w-3/4 rounded-full bg-zinc-100"></div>
                </div>
                <div class="h-28 w-48 rounded-3xl bg-emerald-100"></div>
              </div>

              <div class="mt-6 flex gap-3">
                <div class="h-9 w-28 rounded-full bg-zinc-200"></div>
                <div class="h-9 w-24 rounded-full bg-zinc-200"></div>
                <div class="h-9 w-28 rounded-full bg-zinc-200"></div>
              </div>

              <div class="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div class="h-28 rounded-2xl bg-slate-100"></div>
                <div class="h-28 rounded-2xl bg-slate-100"></div>
                <div class="h-28 rounded-2xl bg-slate-100"></div>
                <div class="h-28 rounded-2xl bg-slate-100"></div>
              </div>
            </div>
          </div>

          <div class="mt-8 grid gap-6 lg:grid-cols-2">
            <div class="space-y-6">
              <div class="rounded-xl bg-white p-6 shadow-sm">
                <div class="h-5 w-40 rounded-full bg-zinc-200"></div>
                <div class="mt-4 h-7 w-3/4 rounded-full bg-zinc-200"></div>
                <div class="mt-3 h-4 w-full rounded-full bg-zinc-100"></div>
                <div class="mt-2 h-4 w-5/6 rounded-full bg-zinc-100"></div>
                <div class="mt-6 space-y-3 border-t border-zinc-100 pt-5">
                  <div class="h-20 rounded-2xl bg-slate-50"></div>
                  <div class="h-20 rounded-2xl bg-slate-50"></div>
                </div>
              </div>

              <div class="rounded-xl bg-white p-6 shadow-sm">
                <div class="h-5 w-32 rounded-full bg-zinc-200"></div>
                <div class="mt-4 grid grid-cols-2 gap-4">
                  <div class="h-40 rounded-xl bg-zinc-200"></div>
                  <div class="h-40 rounded-xl bg-zinc-200"></div>
                </div>
              </div>
            </div>

            <div class="space-y-6">
              <div class="rounded-xl bg-white p-6 shadow-sm">
                <div class="h-5 w-28 rounded-full bg-zinc-200"></div>
                <div class="mt-4 h-52 rounded-2xl bg-zinc-200"></div>
              </div>

              <div class="rounded-xl bg-white p-6 shadow-sm">
                <div class="h-5 w-36 rounded-full bg-zinc-200"></div>
                <div class="mt-4 h-16 rounded-xl bg-zinc-100"></div>
                <div class="mt-3 h-16 rounded-xl bg-zinc-100"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartnerOfferLoadingSkeletonComponent {}