import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, Validators } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { interval, startWith } from 'rxjs';
import { PublicPartnerOfferService } from '../../../core/services/public-partner-offer.service';
import { PartnersService } from '../../../core/services/partners.service';
import { type PartnerOfferTermsResponse, type PublicPartnerOfferLeadContact, type PublicPartnerOfferResponse, type TimeSlot, centsToEuros } from '../../../core/services/partner-offer.types';
import { BottomSheetComponent } from '../../../shared/components/bottom-sheet/bottom-sheet.component';
import { buildFallbackAttentionPoints, normalizeSummaryForPlainText, parseOfferSummarySections, type ParsedOfferSummary } from './partner-offer-summary.utils';
import { PartnerOfferSummaryCardComponent } from './partner-offer-summary-card.component';
import { PartnerOfferHighlightsSectionComponent } from './partner-offer-highlights-section.component';
import { PartnerOfferLineItemsCardComponent } from './partner-offer-line-items-card.component';
import { PartnerOfferPhotosCardComponent } from './partner-offer-photos-card.component';
import { PartnerOfferLocationCardComponent } from './partner-offer-location-card.component';
import { PartnerOfferPracticalCardComponent } from './partner-offer-practical-card.component';
import { PartnerOfferHeroCardComponent } from './partner-offer-hero-card.component';
import { PartnerOfferStatusBannerComponent } from './partner-offer-status-banner.component';
import { PartnerOfferConfirmationCardComponent } from './partner-offer-confirmation-card.component';
import { PartnerOfferActionsComponent } from './partner-offer-actions.component';
import { PartnerOfferRejectFormComponent } from './partner-offer-reject-form.component';
import { PartnerOfferWizardStepTermsComponent } from './partner-offer-wizard-step-terms.component';
import { PartnerOfferWizardStepDetailsComponent } from './partner-offer-wizard-step-details.component';
import { PartnerOfferWizardStepSignatureComponent } from './partner-offer-wizard-step-signature.component';
import { PartnerOfferWizardStepSlotsComponent } from './partner-offer-wizard-step-slots.component';
import { type AcceptDetailsFormGroup, type PartnerOfferCalendarDay, type PartnerOfferSlotOption } from './partner-offer-wizard.types';

@Component({
  selector: 'app-partner-offer',
  imports: [
    TranslatePipe,
    BottomSheetComponent,
    PartnerOfferSummaryCardComponent,
    PartnerOfferHighlightsSectionComponent,
    PartnerOfferLineItemsCardComponent,
    PartnerOfferPhotosCardComponent,
    PartnerOfferLocationCardComponent,
    PartnerOfferPracticalCardComponent,
    PartnerOfferHeroCardComponent,
    PartnerOfferStatusBannerComponent,
    PartnerOfferConfirmationCardComponent,
    PartnerOfferActionsComponent,
    PartnerOfferRejectFormComponent,
    PartnerOfferWizardStepTermsComponent,
    PartnerOfferWizardStepDetailsComponent,
    PartnerOfferWizardStepSignatureComponent,
    PartnerOfferWizardStepSlotsComponent, 
  ],
  templateUrl: './partner-offer.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartnerOfferComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly offerService = inject(PublicPartnerOfferService);
  private readonly partnersService = inject(PartnersService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);

  // Mode
  protected readonly isPreview = signal(false);

  // State
  protected readonly loading = signal(true);
  protected readonly offer = signal<PublicPartnerOfferResponse | null>(null);
  protected readonly errorKey = signal<string | null>(null);
  protected readonly accepting = signal(false);
  protected readonly rejecting = signal(false);
  protected readonly done = signal<'accepted' | 'rejected' | null>(null);
  protected readonly termsLoading = signal(false);
  protected readonly termsContent = signal('');
  protected readonly termsVersion = signal<number | null>(null);
  protected readonly pdfReady = signal(false);
  protected readonly pdfWaiting = signal(false);
  protected readonly pdfError = signal(false);
  protected readonly pdfDownloadUrl = signal<string | null>(null);

  // Live clock for countdown (ticks every minute)
  protected readonly now = signal(new Date());

  protected readonly timeRemaining = computed(() => {
    const o = this.offer();
    if (!o) return null;

    const expiresMs = new Date(o.expiresAt).getTime();
    const diffMs = expiresMs - this.now().getTime();
    const clampedMs = Math.max(0, diffMs);
    const totalMinutes = Math.floor(clampedMs / 60_000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return { hours, minutes };
  });

  protected readonly deadlineBadgeClass = computed(() => {
    const tr = this.timeRemaining();
    if (!tr) return 'bg-gray-100 text-slate-500';
    if (this.isExpired()) return 'bg-zinc-200 text-zinc-600';
    const totalMinutes = tr.hours * 60 + tr.minutes;
    if (totalMinutes <= 120) return 'bg-red-50 text-red-700';
    if (totalMinutes <= 360) return 'bg-amber-50 text-amber-700';
    return 'bg-emerald-50 text-emerald-700';
  });

  // Accept form
  protected readonly inspectionSlots = signal<TimeSlot[]>([]);
  protected readonly jobSlots = signal<TimeSlot[]>([]);

  protected readonly inspectionMonth = signal(this.startOfMonth(new Date()));
  protected readonly jobMonth = signal(this.startOfMonth(new Date()));
  protected readonly selectedInspectionDate = signal<string | null>(null);
  protected readonly selectedJobDate = signal<string | null>(null);
  private readonly slotMinutes = 60;
  protected readonly slotOptions: PartnerOfferSlotOption[] = this.buildSlotOptions();

  // Accept wizard (bottom sheet, 4 steps)
  protected readonly showAcceptSheet = signal(false);
  protected readonly acceptStep = signal<1 | 2 | 3 | 4>(1);
  protected readonly termsAccepted = signal(false);
  protected readonly acceptDetailsForm = this.fb.nonNullable.group({
    signerFullName: ['', [Validators.required]],
    signerBusinessName: ['', [Validators.required]],
    signerAddress: ['', [Validators.required]],
  }) as AcceptDetailsFormGroup;
  protected readonly signatureData = signal<string | null>(null);
  protected readonly step2Attempted = signal(false);
  private readonly acceptDetailsStatus = toSignal(
    this.acceptDetailsForm.statusChanges.pipe(startWith(this.acceptDetailsForm.status)),
    { initialValue: this.acceptDetailsForm.status },
  );

  protected readonly canProceedStep1 = computed(() => this.termsAccepted());
  protected readonly canProceedStep2 = computed(() => this.acceptDetailsStatus() === 'VALID');
  protected readonly canProceedStep3 = computed(() => !!this.signatureData());
  protected readonly canSubmitStep4 = computed(() => {
    const needsInspection = this.offer()?.requiresInspection !== false;
    if (needsInspection && this.inspectionSlots().length === 0) return false;
    if (this.inspectionErrors().length > 0) return false;
    if (this.jobErrors().length > 0) return false;
    return true;
  });

  protected readonly inspectionErrors = computed(() => {
    const slots = this.inspectionSlots();
    if (slots.length === 0) return [];
    return this.validateSlots(slots, false);
  });

  protected readonly jobErrors = computed(() => {
    const slots = this.jobSlots();
    if (slots.length === 0) return [];
    return this.validateSlots(slots, false);
  });

  // Reject form
  protected readonly showRejectForm = signal(false);
  protected readonly rejectReason = signal('');

  // Derived
  protected readonly priceDisplay = computed(() => {
    const o = this.offer();
    return o ? centsToEuros(o.vakmanPriceCents) : '';
  });

  protected readonly summaryDisplay = computed(() => {
    const o = this.offer();
    if (!o) return '';
    const builderSummary = (o.builderSummary || '').trim();
    if (builderSummary) return builderSummary;
    const summary = (o.jobSummaryShort || '').trim();
    return summary || o.jobSummary;
  });

  protected readonly summaryPlainDisplay = computed(() => {
    return normalizeSummaryForPlainText(this.summaryDisplay());
  });

  protected readonly summaryHeadline = computed(() => {
    const o = this.offer();
    if (!o) return '';

    const shortSummary = normalizeSummaryForPlainText(o.jobSummaryShort || '');
    if (shortSummary) return shortSummary;

    const parsedDetailedSummary = parseOfferSummarySections(this.summaryDisplay());
    const detailedIntro = normalizeSummaryForPlainText(parsedDetailedSummary.intro);
    if (detailedIntro) {
      return detailedIntro.length > 160
        ? `${detailedIntro.slice(0, 157).trimEnd()}...`
        : detailedIntro;
    }

    const normalizedSummary = this.summaryPlainDisplay();
    if (!normalizedSummary) return o.jobSummary;

    return normalizedSummary.length > 160
      ? `${normalizedSummary.slice(0, 157).trimEnd()}...`
      : normalizedSummary;
  });

  protected readonly summaryIntro = computed(() => {
    const o = this.offer();
    if (!o) return '';

    const parsedDetailedSummary = parseOfferSummarySections(this.summaryDisplay());
    const detailedIntro = normalizeSummaryForPlainText(parsedDetailedSummary.intro);
    if (detailedIntro) {
      const headline = this.summaryHeadline();
      if (detailedIntro !== headline) {
        return detailedIntro;
      }
    }

    const normalizedSummary = this.summaryPlainDisplay();
    if (!normalizedSummary) return '';

    const headline = this.summaryHeadline();
    if (!headline) return normalizedSummary;

    if (normalizedSummary === headline) return o.jobSummary;

    const remainder = normalizedSummary.startsWith(headline)
      ? normalizedSummary.slice(headline.length).trim()
      : normalizedSummary;

    return remainder.replace(/^[.:;,-]+\s*/, '') || o.jobSummary;
  });

  protected readonly parsedSummary = computed<ParsedOfferSummary>(() => {
    const offer = this.offer();
    const summary = this.summaryDisplay();
    const parsed = parseOfferSummarySections(summary);

    if (!parsed.intro) {
      parsed.intro = this.summaryIntro() || this.summaryHeadline();
    }

    if (parsed.workItems.length === 0 && offer?.lineItems?.length) {
      parsed.workItems = offer.lineItems
        .map((item) => normalizeSummaryForPlainText(item.description))
        .filter((item) => item.length > 0)
        .slice(0, 3);
    }

    if (parsed.attentionPoints.length === 0) {
      parsed.attentionPoints = buildFallbackAttentionPoints(offer);
    }

    return parsed;
  });

  protected readonly summaryCardIntro = computed(() => {
    const parsedIntro = this.parsedSummary().intro;
    if (parsedIntro) {
      return parsedIntro;
    }

    return this.summaryIntro() || this.summaryHeadline();
  });

  protected readonly workItemsPreview = computed(() => this.parsedSummary().workItems.slice(0, 3));

  protected readonly attentionPointsPreview = computed(() => this.parsedSummary().attentionPoints.slice(0, 3));

  protected readonly inspectionRequirementKey = computed(() => {
    const requiresInspection = this.offer()?.requiresInspection;
    if (requiresInspection === false) return 'partners.offer.meta.inspectionNotRequired';
    if (requiresInspection === true) return 'partners.offer.meta.inspectionRequired';
    return '';
  });

  protected readonly constructionYearDisplay = computed(() => {
    const o = this.offer();
    if (!o?.constructionYear) return '';
    return String(o.constructionYear);
  });

  protected readonly scopeDisplayKey = computed(() => {
    const o = this.offer();
    const scope = (o?.scopeAssessment || '').toLowerCase();
    if (!scope) return '';
    switch (scope) {
      case 'small':
        return 'partners.offer.scope.small';
      case 'medium':
        return 'partners.offer.scope.medium';
      case 'large':
        return 'partners.offer.scope.large';
      default:
        return '';
    }
  });

  protected readonly urgencyDisplayKey = computed(() => {
    const o = this.offer();
    const urgency = (o?.urgencyLevel || '').toLowerCase();
    if (!urgency) return '';
    switch (urgency) {
      case 'high':
        return 'partners.offer.urgency.high';
      case 'medium':
        return 'partners.offer.urgency.medium';
      case 'low':
        return 'partners.offer.urgency.low';
      default:
        return '';
    }
  });

  protected readonly locationLabel = computed(() => {
    const o = this.offer();
    if (!o) return '';
    if (o.buurtcode) return `${o.buurtcode} · ${o.city}`;
    if (o.postcode4) return `${o.postcode4} ${o.city}`;
    return o.city;
  });

  protected readonly mapQuery = computed(() => {
    const o = this.offer();
    if (!o) return '';
    if (o.postcode4) return `${o.postcode4} ${o.city}`;
    return o.city;
  });

  protected readonly lineItems = computed(() => this.offer()?.lineItems ?? []);
  protected readonly leadContact = computed<PublicPartnerOfferLeadContact | null>(() => this.offer()?.leadContact ?? null);
  protected readonly showAcceptedConfirmation = computed(() => this.done() === 'accepted' || this.offer()?.status === 'accepted');

  protected readonly photoItems = computed(() => {
    const offer = this.offer();
    if (!offer?.photos?.length) return [];

    const token = this.route.snapshot.paramMap.get('token');
    const offerId = this.route.snapshot.paramMap.get('offerId');

    return offer.photos.map((photo) => ({
      ...photo,
      url: this.resolvePhotoUrl(token, offerId, photo.id),
      label: this.attachmentLabel(photo.fileName),
    })).filter((photo) => photo.url !== '');
  });

  protected readonly statusBadgeClass = computed(() => {
    if (this.done() === 'accepted') return 'bg-emerald-100 text-emerald-700';
    if (this.done() === 'rejected') return 'bg-rose-100 text-rose-700';
    const o = this.offer();
    if (!o) return 'bg-zinc-100 text-zinc-600';
    if (this.isExpired()) return 'bg-amber-100 text-amber-700';
    if (o.status === 'accepted') return 'bg-emerald-100 text-emerald-700';
    if (o.status === 'rejected') return 'bg-rose-100 text-rose-700';
    return 'bg-blue-100 text-blue-700';
  });

  protected readonly mobileStatusBadge = computed(() => {
    if (this.done() === 'accepted') return 'bg-green-500 shadow-green-500/20 ring-green-50';
    if (this.done() === 'rejected') return 'bg-red-500 shadow-red-500/20 ring-red-50';
    const o = this.offer();
    if (!o) return 'bg-blue-500 shadow-blue-500/20 ring-blue-50';
    if (this.isExpired()) return 'bg-zinc-400 shadow-zinc-400/20 ring-zinc-100';
    if (o.status === 'accepted') return 'bg-green-500 shadow-green-500/20 ring-green-50';
    if (o.status === 'rejected') return 'bg-red-500 shadow-red-500/20 ring-red-50';
    return 'bg-teal-500 shadow-teal-500/20 ring-teal-50';
  });

  protected readonly isMobile = signal(globalThis.window !== undefined && globalThis.window.innerWidth < 640);

  protected readonly inspectionCalendarDays = computed<PartnerOfferCalendarDay[]>(() => this.buildCalendarDays(this.inspectionMonth()));
  protected readonly jobCalendarDays = computed<PartnerOfferCalendarDay[]>(() => this.buildCalendarDays(this.jobMonth()));

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
    interval(60_000)
      .pipe(startWith(0), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.now.set(new Date()));

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

    if (!preview && token) {
      this.loadTerms(token);
    }

    source$.subscribe({
      next: (offer) => {
        this.offer.set(offer);
        this.loading.set(false);
        this.updateAcceptedState(token, offer);
      },
      error: () => {
        this.errorKey.set('partners.offer.errors.loadFailed');
        this.loading.set(false);
      },
    });
  }

  protected toggleInspectionSlot(startTime: string): void {
    const date = this.selectedInspectionDate();
    if (!date) return;
    const isoStart = this.toIsoString(date, startTime);
    const isoEnd = this.toIsoString(date, this.getSlotEndTime(startTime));
    const idx = this.inspectionSlots().findIndex((s) => s.start === isoStart);
    if (idx >= 0) {
      this.inspectionSlots.update((slots) => slots.filter((_, i) => i !== idx));
    } else {
      this.inspectionSlots.update((slots) => [...slots, { start: isoStart, end: isoEnd }]);
    }
  }

  protected removeInspectionSlot(index: number): void {
    this.inspectionSlots.update((slots) => slots.filter((_, i) => i !== index));
  }

  protected toggleJobSlot(startTime: string): void {
    const date = this.selectedJobDate();
    if (!date) return;
    const isoStart = this.toIsoString(date, startTime);
    const isoEnd = this.toIsoString(date, this.getSlotEndTime(startTime));
    const idx = this.jobSlots().findIndex((s) => s.start === isoStart);
    if (idx >= 0) {
      this.jobSlots.update((slots) => slots.filter((_, i) => i !== idx));
    } else {
      this.jobSlots.update((slots) => [...slots, { start: isoStart, end: isoEnd }]);
    }
  }

  protected removeJobSlot(index: number): void {
    this.jobSlots.update((slots) => slots.filter((_, i) => i !== index));
  }

  /** Open the accept bottom-sheet wizard directly */
  protected openAcceptSheet(): void {
    const partnerPrefill = this.offer()?.partnerPrefill;

    this.showRejectForm.set(false);
    this.acceptStep.set(1);
    this.termsAccepted.set(false);
    this.acceptDetailsForm.reset({
      signerFullName: (partnerPrefill?.fullName ?? '').trim(),
      signerBusinessName: (partnerPrefill?.businessName ?? '').trim(),
      signerAddress: (partnerPrefill?.address ?? '').trim(),
    });
    this.acceptDetailsForm.markAsPristine();
    this.acceptDetailsForm.markAsUntouched();
    this.signatureData.set(null);
    this.inspectionSlots.set([]);
    this.jobSlots.set([]);
    this.selectedInspectionDate.set(null);
    this.selectedJobDate.set(null);
    this.inspectionMonth.set(this.startOfMonth(new Date()));
    this.jobMonth.set(this.startOfMonth(new Date()));
    this.step2Attempted.set(false);
    this.showAcceptSheet.set(true);
  }

  protected closeAcceptSheet(): void {
    this.showAcceptSheet.set(false);
  }

  protected nextAcceptStep(): void {
    const step = this.acceptStep();
    if (step === 1 && this.canProceedStep1()) {
      this.acceptStep.set(2);
    } else if (step === 2) {
      if (this.canProceedStep2()) {
        this.acceptStep.set(3);
      } else {
        this.step2Attempted.set(true);
        this.acceptDetailsForm.markAllAsTouched();
      }
    } else if (step === 3 && this.canProceedStep3()) {
      this.acceptStep.set(4);
    }
  }

  protected prevAcceptStep(): void {
    const step = this.acceptStep();
    if (step === 2) this.acceptStep.set(1);
    else if (step === 3) this.acceptStep.set(2);
    else if (step === 4) this.acceptStep.set(3);
  }

  protected onSignatureChange(data: string | null): void {
    this.signatureData.set(data);
  }

  protected openRejectForm(): void {
    this.showRejectForm.set(true);
  }

  protected cancelForm(): void {
    this.showRejectForm.set(false);
    this.showAcceptSheet.set(false);
  }

  protected submitAccept(): void {
    const needsInspection = this.offer()?.requiresInspection !== false;
    const slots = this.inspectionSlots();
    if (needsInspection && (slots.length === 0 || this.inspectionErrors().length > 0)) return;
    if (this.jobErrors().length > 0) return;

    const token = this.route.snapshot.paramMap.get('token') ?? '';
    this.accepting.set(true);

    const jobSlots = this.jobSlots();
    const details = this.acceptDetailsForm.getRawValue();
    const signerFullName = details.signerFullName.trim();
    const signerBusinessName = details.signerBusinessName.trim();
    const signerAddress = details.signerAddress.trim();
    const signatureData = this.signatureData();
    const acceptPayload = {
      ...(needsInspection && slots.length > 0 ? { inspectionSlots: slots } : {}),
      ...(jobSlots.length > 0 ? { jobSlots } : {}),
      ...(signerFullName ? { signerFullName } : {}),
      ...(signerBusinessName ? { signerBusinessName } : {}),
      ...(signerAddress ? { signerAddress } : {}),
      ...(signatureData ? { signatureData } : {}),
    };

    this.offerService
      .accept(token, acceptPayload)
      .subscribe({
        next: () => {
          this.offerService.getByToken(token).subscribe({
            next: (offer) => {
              this.accepting.set(false);
              this.offer.set(offer);
              this.done.set('accepted');
              this.showAcceptSheet.set(false);
              this.updateAcceptedState(token, offer, true);
            },
            error: () => {
              this.accepting.set(false);
              this.done.set('accepted');
              this.showAcceptSheet.set(false);
              this.updateAcceptedState(token, null, true);
            },
          });
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

    const reason = this.rejectReason().trim();
    const rejectPayload = reason ? { reason } : {};

    this.offerService
      .reject(token, rejectPayload)
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

  protected selectInspectionDate(date: string): void {
    this.selectedInspectionDate.set(date);
  }

  protected selectJobDate(date: string): void {
    this.selectedJobDate.set(date);
  }

  protected changeInspectionMonth(offset: number): void {
    this.inspectionMonth.set(this.addMonths(this.inspectionMonth(), offset));
  }

  protected changeJobMonth(offset: number): void {
    this.jobMonth.set(this.addMonths(this.jobMonth(), offset));
  }

  protected attachmentLabel(fileName: string): string {
    const withoutExtension = fileName.replace(/\.[^.]+$/, '');
    const normalized = withoutExtension
      .replaceAll(/photo/gi, '')
      .replaceAll(/foto/gi, '')
      .replaceAll(/[_-]+/g, ' ')
      .replaceAll(/\s+/g, ' ')
      .trim();

    return normalized || 'Afbeelding';
  }

  private validateSlots(slots: TimeSlot[], requireAtLeastOne: boolean): string[] {
    const errors: string[] = [];
    if (requireAtLeastOne && slots.length === 0) {
      errors.push('partners.offer.validation.slotRequired');
      return errors;
    }

    const parsed = slots.reduce<{ start: Date; end: Date }[]>((acc, slot) => {
      const start = this.parseDate(slot.start);
      const end = this.parseDate(slot.end);
      if (start && end) {
        acc.push({ start, end });
      }
      return acc;
    }, []);

    parsed.sort((a, b) => a.start.getTime() - b.start.getTime());

    const now = new Date();
    for (const slot of parsed) {
      if (slot.start >= slot.end) {
        errors.push('partners.offer.validation.slotOrder');
        break;
      }
      if (slot.start <= now) {
        errors.push('partners.offer.validation.slotPast');
        break;
      }
    }

    for (let i = 1; i < parsed.length; i += 1) {
      const current = parsed[i];
      const previous = parsed[i - 1];
      if (!current || !previous) {
        continue;
      }
      if (current.start < previous.end) {
        errors.push('partners.offer.validation.slotOverlap');
        break;
      }
    }

    if (parsed.length !== slots.length) {
      errors.push('partners.offer.validation.slotInvalid');
    }

    return Array.from(new Set(errors));
  }

  private parseDate(value: string): Date | null {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  }

  private toIsoString(date: string, time: string): string {
    // time can be "HH:MM" or "HH:MM:SS" depending on browser
    const normalizedTime = time.length === 5 ? `${time}:00` : time;
    const combined = new Date(`${date}T${normalizedTime}`);
    const offsetMinutes = combined.getTimezoneOffset();
    const absOffset = Math.abs(offsetMinutes);
    const offsetHours = String(Math.floor(absOffset / 60)).padStart(2, '0');
    const offsetMins = String(absOffset % 60).padStart(2, '0');
    const sign = offsetMinutes <= 0 ? '+' : '-';
    return `${date}T${normalizedTime}${sign}${offsetHours}:${offsetMins}`;
  }

  private buildSlotOptions(): PartnerOfferSlotOption[] {
    const options: PartnerOfferSlotOption[] = [];
    for (let hour = 8; hour < 18; hour += 1) {
      const start = `${String(hour).padStart(2, '0')}:00`;
      const end = this.getSlotEndTime(start);
      options.push({ start, end, label: `${start} - ${end}` });
    }
    return options;
  }

  private getSlotEndTime(startTime: string): string {
    return this.addMinutesToTime(startTime, this.slotMinutes);
  }

  private addMinutesToTime(time: string, minutes: number): string {
    const [hoursRaw, minsRaw] = time.split(':');
    const hours = Number(hoursRaw ?? 0);
    const mins = Number(minsRaw ?? 0);
    const total = hours * 60 + mins + minutes;
    const nextHours = Math.floor(total / 60);
    const nextMins = total % 60;
    return `${String(nextHours).padStart(2, '0')}:${String(nextMins).padStart(2, '0')}`;
  }

  private startOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  private addMonths(date: Date, offset: number): Date {
    return new Date(date.getFullYear(), date.getMonth() + offset, 1);
  }

  private buildCalendarDays(month: Date): PartnerOfferCalendarDay[] {
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const firstOfMonth = new Date(year, monthIndex, 1);
    const startOffset = (firstOfMonth.getDay() + 6) % 7;
    const start = new Date(year, monthIndex, 1 - startOffset);
    const days: PartnerOfferCalendarDay[] = [];
    for (let i = 0; i < 42; i += 1) {
      const current = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const dateKey = this.formatDate(current);
      const isCurrentMonth = current.getMonth() === monthIndex;
      const today = new Date();
      const isToday = current.toDateString() === today.toDateString();
      days.push({
        key: dateKey,
        label: current.getDate(),
        date: dateKey,
        isCurrentMonth,
        isToday,
      });
    }
    return days;
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private resolvePhotoUrl(token: string | null, offerId: string | null, photoId: string): string {
    if (token) {
      return this.offerService.buildPhotoUrl(token, photoId);
    }
    if (offerId) {
      return this.partnersService.buildPreviewOfferPhotoUrl(offerId, photoId);
    }
    return '';
  }

  protected retryPdfReady(): void {
    const token = this.route.snapshot.paramMap.get('token') ?? '';
    const offer = this.offer();
    if (!token || offer?.status !== 'accepted') {
      return;
    }
    this.startPdfReadyWatcher(token, true);
  }

  private loadTerms(token: string): void {
    this.termsLoading.set(true);
    this.offerService.getTerms(token)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (terms: PartnerOfferTermsResponse) => {
          this.termsContent.set(terms.content?.trim() ?? '');
          this.termsVersion.set(terms.version ?? null);
          this.termsLoading.set(false);
        },
        error: () => {
          this.termsLoading.set(false);
        },
      });
  }

  private updateAcceptedState(token: string, offer: PublicPartnerOfferResponse | null, force = false): void {
    const currentOffer = offer ?? this.offer();
    if (!token || this.isPreview()) {
      return;
    }
    if (currentOffer?.status !== 'accepted') {
      this.pdfReady.set(false);
      this.pdfWaiting.set(false);
      this.pdfError.set(false);
      this.pdfDownloadUrl.set(null);
      return;
    }
    this.pdfDownloadUrl.set(this.offerService.buildPdfUrl(token));
    this.startPdfReadyWatcher(token, force);
  }

  private startPdfReadyWatcher(token: string, force = false): void {
    if (this.pdfReady()) {
      return;
    }
    if (this.pdfWaiting() && !force) {
      return;
    }
    this.pdfWaiting.set(true);
    this.pdfError.set(false);
    this.offerService.waitForPdfReady(token)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.pdfReady.set(true);
          this.pdfWaiting.set(false);
          this.pdfError.set(false);
        },
        error: () => {
          this.pdfWaiting.set(false);
          this.pdfError.set(true);
        },
      });
  }
}
