import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { type AcceptDetailsFormGroup } from './partner-offer-wizard.types';

@Component({
  selector: 'app-partner-offer-wizard-step-details',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe],
  template: `
    <div class="typeform-step">
      <div class="typeform-step-number">2</div>
      <h3 class="text-xl font-extrabold tracking-tight text-zinc-900">{{ 'partners.offer.wizard.detailsHeading' | translate }}</h3>
      <p class="mt-2 text-sm text-zinc-500">{{ 'partners.offer.wizard.detailsBody' | translate }}</p>

      <form class="mt-6 space-y-4" [formGroup]="form()" novalidate>
        <div>
          <label for="accept-full-name" class="block text-xs font-bold uppercase tracking-widest text-zinc-400">{{ 'partners.offer.wizard.fullName' | translate }}</label>
          <input id="accept-full-name" type="text" formControlName="signerFullName" class="mt-2 w-full rounded-2xl border bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2" [class.border-red-400]="fieldInvalid('signerFullName')" [class.focus:ring-red-500/20]="fieldInvalid('signerFullName')" [class.focus:border-red-500]="fieldInvalid('signerFullName')" [class.border-zinc-200]="!fieldInvalid('signerFullName')" [class.focus:ring-teal-500/20]="!fieldInvalid('signerFullName')" [class.focus:border-teal-500]="!fieldInvalid('signerFullName')" [attr.aria-invalid]="fieldInvalid('signerFullName') ? 'true' : null" [attr.aria-describedby]="fieldInvalid('signerFullName') ? 'accept-full-name-error' : null" [placeholder]="'partners.offer.wizard.fullNamePlaceholder' | translate" />
          @if (fieldInvalid('signerFullName')) {
            <p id="accept-full-name-error" role="alert" class="mt-1 text-xs text-rose-600">{{ 'partners.offer.wizard.fieldRequired' | translate }}</p>
          }
        </div>

        <div>
          <label for="accept-business-name" class="block text-xs font-bold uppercase tracking-widest text-zinc-400">{{ 'partners.offer.wizard.businessName' | translate }}</label>
          <input id="accept-business-name" type="text" formControlName="signerBusinessName" class="mt-2 w-full rounded-2xl border bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2" [class.border-red-400]="fieldInvalid('signerBusinessName')" [class.focus:ring-red-500/20]="fieldInvalid('signerBusinessName')" [class.focus:border-red-500]="fieldInvalid('signerBusinessName')" [class.border-zinc-200]="!fieldInvalid('signerBusinessName')" [class.focus:ring-teal-500/20]="!fieldInvalid('signerBusinessName')" [class.focus:border-teal-500]="!fieldInvalid('signerBusinessName')" [attr.aria-invalid]="fieldInvalid('signerBusinessName') ? 'true' : null" [attr.aria-describedby]="fieldInvalid('signerBusinessName') ? 'accept-business-name-error' : null" [placeholder]="'partners.offer.wizard.businessNamePlaceholder' | translate" />
          @if (fieldInvalid('signerBusinessName')) {
            <p id="accept-business-name-error" role="alert" class="mt-1 text-xs text-rose-600">{{ 'partners.offer.wizard.fieldRequired' | translate }}</p>
          }
        </div>

        <div>
          <label for="accept-address" class="block text-xs font-bold uppercase tracking-widest text-zinc-400">{{ 'partners.offer.wizard.address' | translate }}</label>
          <input id="accept-address" type="text" formControlName="signerAddress" class="mt-2 w-full rounded-2xl border bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2" [class.border-red-400]="fieldInvalid('signerAddress')" [class.focus:ring-red-500/20]="fieldInvalid('signerAddress')" [class.focus:border-red-500]="fieldInvalid('signerAddress')" [class.border-zinc-200]="!fieldInvalid('signerAddress')" [class.focus:ring-teal-500/20]="!fieldInvalid('signerAddress')" [class.focus:border-teal-500]="!fieldInvalid('signerAddress')" [attr.aria-invalid]="fieldInvalid('signerAddress') ? 'true' : null" [attr.aria-describedby]="fieldInvalid('signerAddress') ? 'accept-address-error' : null" [placeholder]="'partners.offer.wizard.addressPlaceholder' | translate" />
          @if (fieldInvalid('signerAddress')) {
            <p id="accept-address-error" role="alert" class="mt-1 text-xs text-rose-600">{{ 'partners.offer.wizard.fieldRequired' | translate }}</p>
          }
        </div>
      </form>
    </div>
  `,
  styleUrl: './partner-offer-wizard-step.shared.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartnerOfferWizardStepDetailsComponent {
  readonly form = input.required<AcceptDetailsFormGroup>();
  readonly attempted = input(false);

  protected fieldInvalid(field: keyof AcceptDetailsFormGroup['controls']): boolean {
    const control = this.form().controls[field];
    return (this.attempted() || control.touched) && control.invalid;
  }
}