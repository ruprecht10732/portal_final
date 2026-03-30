import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { MarkdownPipe } from '../../../shared/pipes/markdown.pipe';

@Component({
  selector: 'app-partner-offer-wizard-step-terms',
  standalone: true,
  imports: [TranslatePipe, MarkdownPipe],
  template: `
    <div class="typeform-step">
      <div class="typeform-step-number">1</div>
      <h3 class="text-xl font-extrabold tracking-tight text-zinc-900">{{ 'partners.offer.wizard.termsHeading' | translate }}</h3>
      <p class="mt-2 text-sm leading-relaxed text-zinc-500">{{ 'partners.offer.wizard.termsBody' | translate }}</p>

      <div class="mt-6 rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
        @if (termsLoading()) {
          <div class="space-y-2">
            <div class="h-3 w-full rounded bg-zinc-200"></div>
            <div class="h-3 w-5/6 rounded bg-zinc-200"></div>
            <div class="h-3 w-4/6 rounded bg-zinc-200"></div>
          </div>
        } @else if (termsContent()) {
          <div class="markdown-content prose prose-zinc max-h-64 max-w-none overflow-y-auto text-xs leading-relaxed text-zinc-600" [innerHTML]="termsContent() | markdown"></div>
          @if (termsVersion()) {
            <p class="mt-3 text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
              {{ 'partners.offer.wizard.termsVersion' | translate:{ version: termsVersion() } }}
            </p>
          }
        } @else {
          <p class="text-xs leading-relaxed text-zinc-500">{{ 'partners.offer.wizard.termsLegal' | translate }}</p>
        }
      </div>

      <label class="mt-6 flex cursor-pointer items-start gap-3">
        <input type="checkbox" class="mt-0.5 h-5 w-5 rounded border-zinc-300 text-teal-600 focus:ring-teal-500" [checked]="termsAccepted()" (change)="termsAcceptedChange.emit($any($event.target).checked)" />
        <span class="text-sm font-medium text-zinc-700">{{ 'partners.offer.wizard.termsCheckbox' | translate }}</span>
      </label>
    </div>
  `,
  styleUrl: './partner-offer-wizard-step.shared.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartnerOfferWizardStepTermsComponent {
  readonly termsLoading = input(false);
  readonly termsContent = input('');
  readonly termsVersion = input<number | null>(null);
  readonly termsAccepted = input(false);

  readonly termsAcceptedChange = output<boolean>();
}