import { ChangeDetectionStrategy, Component, input, output, viewChild } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { SignaturePadComponent } from '../../../shared/components/signature-pad/signature-pad.component';

@Component({
  selector: 'app-partner-offer-wizard-step-signature',
  standalone: true,
  imports: [TranslatePipe, SignaturePadComponent],
  template: `
    <div class="typeform-step">
      <div class="typeform-step-number">3</div>
      <h3 class="text-xl font-extrabold tracking-tight text-zinc-900">{{ 'partners.offer.wizard.signatureHeading' | translate }}</h3>
      <p class="mt-2 text-sm text-zinc-500">{{ 'partners.offer.wizard.signatureBody' | translate }}</p>

      <div class="mt-6">
        <div class="mb-2 flex items-center justify-between">
          <span class="block text-xs font-bold uppercase tracking-widest text-zinc-400">{{ 'partners.offer.wizard.signatureLabel' | translate }}</span>
          <button type="button" class="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-blue-600 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-40" (click)="clearSignature()" [disabled]="!signatureData()">
            {{ 'partners.offer.wizard.signatureClear' | translate }}
          </button>
        </div>
        <div class="signature-frame rounded-3xl border border-zinc-200 bg-white" (touchstart)="$event.stopPropagation()" (touchmove)="$event.stopPropagation()">
          <app-signature-pad (signatureChange)="signatureChange.emit($event)" />
        </div>
      </div>

      <div class="mt-4 rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
        <p class="text-xs leading-relaxed text-zinc-500">{{ 'partners.offer.wizard.signatureLegal' | translate }}</p>
      </div>
    </div>
  `,
  styleUrl: './partner-offer-wizard-step.shared.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartnerOfferWizardStepSignatureComponent {
  private readonly signaturePad = viewChild<SignaturePadComponent>(SignaturePadComponent);

  readonly signatureData = input<string | null>(null);
  readonly signatureChange = output<string | null>();

  protected clearSignature(): void {
    this.signaturePad()?.clear();
    this.signatureChange.emit(null);
  }
}