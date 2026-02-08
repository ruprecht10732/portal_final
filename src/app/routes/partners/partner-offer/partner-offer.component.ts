import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { PublicPartnerOfferService } from '../../../core/services/public-partner-offer.service';
import { PartnersService } from '../../../core/services/partners.service';
import { type PublicPartnerOfferResponse, type TimeSlot, centsToEuros } from '../../../core/services/partner-offer.types';

@Component({
  selector: 'app-partner-offer',
  imports: [DatePipe, FormsModule, TranslatePipe],
  templateUrl: './partner-offer.component.html',
  styleUrl: './partner-offer.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartnerOfferComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly offerService = inject(PublicPartnerOfferService);
  private readonly partnersService = inject(PartnersService);

  // Mode
  protected readonly isPreview = signal(false);

  // State
  protected readonly loading = signal(true);
  protected readonly offer = signal<PublicPartnerOfferResponse | null>(null);
  protected readonly errorKey = signal<string | null>(null);
  protected readonly accepting = signal(false);
  protected readonly rejecting = signal(false);
  protected readonly done = signal<'accepted' | 'rejected' | null>(null);

  // Accept form
  protected readonly showAcceptForm = signal(false);
  protected readonly inspectionSlots = signal<TimeSlot[]>([{ start: '', end: '' }]);
  protected readonly jobSlots = signal<TimeSlot[]>([]);

  // Reject form
  protected readonly showRejectForm = signal(false);
  protected readonly rejectReason = signal('');

  // Derived
  protected readonly priceDisplay = computed(() => {
    const o = this.offer();
    return o ? centsToEuros(o.vakmanPriceCents) : '';
  });

  protected readonly isActionable = computed(() => {
    if (this.isPreview()) return false;
    const o = this.offer();
    if (!o) return false;
    return (o.status === 'pending' || o.status === 'sent') && new Date(o.expiresAt) > new Date();
  });

  protected readonly isExpired = computed(() => {
    const o = this.offer();
    if (!o) return false;
    return o.status === 'expired' || (o.status !== 'accepted' && o.status !== 'rejected' && new Date(o.expiresAt) <= new Date());
  });

  protected readonly statusLabelKey = computed(() => {
    if (this.done() === 'accepted') return 'partners.offer.status.accepted';
    if (this.done() === 'rejected') return 'partners.offer.status.rejected';
    const o = this.offer();
    if (!o) return '';
    if (this.isExpired()) return 'partners.offer.status.expired';
    switch (o.status) {
      case 'accepted':
        return 'partners.offer.status.accepted';
      case 'rejected':
        return 'partners.offer.status.rejected';
      case 'expired':
        return 'partners.offer.status.expired';
      default:
        return 'partners.offer.status.open';
    }
  });

  ngOnInit(): void {
    const preview = this.route.snapshot.data['preview'] === true;
    this.isPreview.set(preview);

    const token = this.route.snapshot.paramMap.get('token') ?? '';
    const offerId = this.route.snapshot.paramMap.get('offerId') ?? '';

    if (!token && !offerId) {
      this.errorKey.set('partners.offer.errors.invalidLink');
      this.loading.set(false);
      return;
    }

    const source$ = preview && offerId
      ? this.partnersService.previewOffer(offerId)
      : this.offerService.getByToken(token);

    source$.subscribe({
      next: (offer) => {
        this.offer.set(offer);
        this.loading.set(false);
      },
      error: () => {
        this.errorKey.set('partners.offer.errors.loadFailed');
        this.loading.set(false);
      },
    });
  }

  protected addInspectionSlot(): void {
    this.inspectionSlots.update((slots) => [...slots, { start: '', end: '' }]);
  }

  protected removeInspectionSlot(index: number): void {
    this.inspectionSlots.update((slots) => slots.filter((_, i) => i !== index));
  }

  protected updateInspectionSlotStart(index: number, value: string): void {
    this.inspectionSlots.update((slots) => slots.map((s, i) => i === index ? { ...s, start: value } : s));
  }

  protected updateInspectionSlotEnd(index: number, value: string): void {
    this.inspectionSlots.update((slots) => slots.map((s, i) => i === index ? { ...s, end: value } : s));
  }

  protected addJobSlot(): void {
    this.jobSlots.update((slots) => [...slots, { start: '', end: '' }]);
  }

  protected removeJobSlot(index: number): void {
    this.jobSlots.update((slots) => slots.filter((_, i) => i !== index));
  }

  protected updateJobSlotStart(index: number, value: string): void {
    this.jobSlots.update((slots) => slots.map((s, i) => i === index ? { ...s, start: value } : s));
  }

  protected updateJobSlotEnd(index: number, value: string): void {
    this.jobSlots.update((slots) => slots.map((s, i) => i === index ? { ...s, end: value } : s));
  }

  protected openAcceptForm(): void {
    this.showAcceptForm.set(true);
    this.showRejectForm.set(false);
  }

  protected openRejectForm(): void {
    this.showRejectForm.set(true);
    this.showAcceptForm.set(false);
  }

  protected cancelForm(): void {
    this.showAcceptForm.set(false);
    this.showRejectForm.set(false);
  }

  protected submitAccept(): void {
    const token = this.route.snapshot.paramMap.get('token') ?? '';
    const slots = this.inspectionSlots().filter((s) => s.start && s.end);
    if (slots.length === 0) return;

    this.accepting.set(true);
    const jobSlots = this.jobSlots().filter((s) => s.start && s.end);

    this.offerService
      .accept(token, {
        inspectionSlots: slots,
        jobSlots: jobSlots.length > 0 ? jobSlots : undefined,
      })
      .subscribe({
        next: () => {
          this.accepting.set(false);
          this.done.set('accepted');
          this.showAcceptForm.set(false);
        },
        error: () => {
          this.accepting.set(false);
          this.errorKey.set('partners.offer.errors.acceptFailed');
        },
      });
  }

  protected submitReject(): void {
    const token = this.route.snapshot.paramMap.get('token') ?? '';
    this.rejecting.set(true);

    this.offerService
      .reject(token, { reason: this.rejectReason() || undefined })
      .subscribe({
        next: () => {
          this.rejecting.set(false);
          this.done.set('rejected');
          this.showRejectForm.set(false);
        },
        error: () => {
          this.rejecting.set(false);
          this.errorKey.set('partners.offer.errors.rejectFailed');
        },
      });
  }
}
