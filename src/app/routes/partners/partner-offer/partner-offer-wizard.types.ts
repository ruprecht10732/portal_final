import { type FormControl, type FormGroup } from '@angular/forms';

export type AcceptDetailsFormGroup = FormGroup<{
  signerFullName: FormControl<string>;
  signerBusinessName: FormControl<string>;
  signerAddress: FormControl<string>;
}>;

export type PartnerOfferCalendarDay = {
  key: string;
  label: number;
  date: string;
  isCurrentMonth: boolean;
  isToday: boolean;
};

export type PartnerOfferSlotOption = {
  start: string;
  end: string;
  label: string;
};