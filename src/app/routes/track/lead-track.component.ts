import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { PublicLeadTrackingService } from '../../core/services/public-lead-tracking.service';
import type {
  AttachmentSummary,
  AppointmentSummary,
  AvailableDaySlots,
  AvailableTimeSlot,
  LeadPreferences,
  PublicLeadTrackingResponse,
} from '../../core/services/public-lead-tracking.types';

@Component({
  selector: 'app-lead-track',
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './lead-track.component.html',
  styleUrl: './lead-track.component.css',
  providers: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeadTrackComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(PublicLeadTrackingService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly datePipe = inject(DatePipe);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly data = signal<PublicLeadTrackingResponse | null>(null);
  protected readonly savingPreferences = signal(false);
  protected readonly savingInfo = signal(false);
  protected readonly uploadBusy = signal(false);
  protected readonly uploadError = signal<string | null>(null);
  protected readonly uploadSuccess = signal(false);
  protected readonly deleteBusyId = signal<string | null>(null);
  protected readonly deleteError = signal<string | null>(null);
  protected readonly infoSuccess = signal(false);
  protected readonly preferencesSuccess = signal(false);
  protected readonly slotRequestSuccess = signal(false);
  protected readonly token = signal('');
  protected readonly showUploadSheet = signal(false);
  protected readonly activePreferenceSheet = signal<'budget' | 'timeframe' | 'availability' | 'extraNotes' | null>(null);
  protected readonly availableSlots = signal<AvailableDaySlots[]>([]);
  protected readonly slotDates = signal<string[]>([]);
  protected readonly selectedSlotDate = signal<string | null>(null);
  protected readonly selectedSlot = signal<AvailableTimeSlot | null>(null);
  protected readonly loadingSlots = signal(false);
  protected readonly slotError = signal<string | null>(null);
  protected readonly requestingAppointment = signal(false);
  protected readonly timeframeSelection = signal('');
  protected readonly customTimeframe = signal('');
  protected readonly timeframeOptions = [
    'Zo snel mogelijk',
    'Binnen 14 dagen',
    'Binnen een maand',
    'Over 1 tot 3 maanden',
    'Ik ben me nog aan het orienteren',
    'Anders',
  ];

  protected openUploadSheet(): void {
    this.showUploadSheet.set(true);
  }

  protected closeUploadSheet(): void {
    this.showUploadSheet.set(false);
  }

  protected openPreferenceSheet(which: 'budget' | 'timeframe' | 'availability' | 'extraNotes'): void {
    this.preferencesSuccess.set(false);
    this.slotRequestSuccess.set(false);
    this.activePreferenceSheet.set(which);

    if (which === 'availability') {
      this.loadAvailableSlots();
    }

	if (which === 'timeframe') {
		this.initTimeframeSelection();
	}
  }

  protected closePreferenceSheet(): void {
    this.activePreferenceSheet.set(null);
  }

  protected submitPreferenceAndClose(): void {
    this.submitPreferences();
    // Close sheet after a short delay to show the success state
    setTimeout(() => this.activePreferenceSheet.set(null), 600);
  }

  protected requestAppointmentAndClose(): void {
    this.requestAppointment();
    // Close sheet after a short delay to show the success state
    setTimeout(() => {
      if (this.slotRequestSuccess()) {
        this.activePreferenceSheet.set(null);
      }
    }, 800);
  }

  protected scrollToTop(): void {
    globalThis.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected scrollToSection(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  protected readonly preferencesForm = this.fb.nonNullable.group({
    budgetMin: [''],
    budgetMax: [''],
    timeframe: [''],
    availability: [''],
    extraNotes: [''],
  });

  protected readonly infoForm = this.fb.nonNullable.group({
    text: ['', [Validators.required, Validators.minLength(5)]],
  });

  protected readonly steps = computed(() => {
    const current = this.data()?.status.step ?? 1;
    return [1, 2, 3, 4].map(step => ({ step, active: step <= current }));
  });

  protected readonly imageAttachments = computed<AttachmentSummary[]>(() => {
    const attachments = this.data()?.attachments ?? [];
    return attachments.filter(att => att.contentType?.startsWith('image/') && !!att.downloadUrl);
  });

  protected readonly documentAttachments = computed<AttachmentSummary[]>(() => {
    const attachments = this.data()?.attachments ?? [];
    return attachments.filter(att => !att.contentType?.startsWith('image/') && !!att.downloadUrl);
  });

  protected readonly appointmentList = computed<AppointmentSummary[]>(() => {
    const current = this.data();
    if (!current) return [];

    const items: AppointmentSummary[] = [];
    if (current.appointments?.length) {
      items.push(...current.appointments);
    } else {
      if (current.appointment) {
        items.push({ ...current.appointment, status: current.appointment.status || 'scheduled' });
      }
      if (current.appointmentRequest) {
        items.push({ ...current.appointmentRequest, status: current.appointmentRequest.status || 'requested' });
      }
    }

    const unique = new Map<string, AppointmentSummary>();
    for (const item of items) {
      unique.set(item.id, item);
    }

    return Array.from(unique.values()).sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );
  });

  protected readonly primaryAppointment = computed<AppointmentSummary | null>(() => {
    const items = this.appointmentList();
    if (items.length === 0) return null;
    const scheduled = items.find(item => item.status === 'scheduled');
    return scheduled ?? items[0] ?? null;
  });

  protected readonly hasScheduledAppointment = computed(() =>
    this.appointmentList().some(item => item.status === 'scheduled'),
  );

  protected readonly hasRequestedAppointment = computed(() =>
    this.appointmentList().some(item => item.status === 'requested'),
  );

  protected readonly whatsappUrl = computed(() => {
    const phone = this.data()?.organizationPhone?.trim();
    if (!phone) return '';
    const digits = phone.replaceAll(/\D/g, '');
    const normalized = digits.startsWith('00') ? digits.slice(2) : digits;
    return normalized ? `https://wa.me/${normalized}` : '';
  });

  protected selectTimeframe(option: string): void {
    this.timeframeSelection.set(option);
    if (option === 'Anders') {
      const value = this.customTimeframe().trim();
      this.preferencesForm.controls.timeframe.setValue(value);
      return;
    }

    this.customTimeframe.set('');
    this.preferencesForm.controls.timeframe.setValue(option);
  }

  protected onCustomTimeframeInput(event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.customTimeframe.set(value);
    this.preferencesForm.controls.timeframe.setValue(value);
  }

  ngOnInit(): void {
    const token = this.route.snapshot.paramMap.get('token');
    if (!token) {
      this.error.set('Deze link is ongeldig.');
      this.loading.set(false);
      return;
    }

    this.token.set(token);
    this.load(token);

    this.destroyRef.onDestroy(() => {
      this.preferencesForm.reset();
      this.infoForm.reset();
    });
  }

  protected submitPreferences(): void {
    if (this.savingPreferences()) return;
    const token = this.token();
    if (!token) return;

    this.preferencesSuccess.set(false);
    this.savingPreferences.set(true);

    const raw = this.preferencesForm.getRawValue();
    const budget = this.formatBudget(raw.budgetMin, raw.budgetMax);
    const payload = { budget, timeframe: raw.timeframe, availability: raw.availability, extraNotes: raw.extraNotes };
    this.service.updatePreferences(token, payload).subscribe({
      next: () => {
        this.savingPreferences.set(false);
        this.preferencesSuccess.set(true);
        this.data.update(current => (current ? { ...current, preferences: payload } : current));
      },
      error: () => {
        this.savingPreferences.set(false);
      },
    });
  }

  protected submitInfo(): void {
    if (this.savingInfo()) return;
    if (this.infoForm.invalid) {
      this.infoForm.markAllAsTouched();
      return;
    }

    const token = this.token();
    if (!token) return;

    this.infoSuccess.set(false);
    this.savingInfo.set(true);

    const payload = this.infoForm.getRawValue();
    this.service.addInfo(token, payload).subscribe({
      next: () => {
        this.savingInfo.set(false);
        this.infoSuccess.set(true);
        this.infoForm.reset();
      },
      error: () => {
        this.savingInfo.set(false);
      },
    });
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) return;

    if (input) {
      input.value = '';
    }

    this.uploadFile(file);
  }

  protected deleteAttachment(att: AttachmentSummary): void {
    const token = this.token();
    if (!token) return;

    if (!globalThis.confirm('Weet je zeker dat je deze afbeelding wilt verwijderen?')) {
      return;
    }

    this.deleteError.set(null);
    this.deleteBusyId.set(att.id);

    this.service.deleteAttachment(token, att.id).subscribe({
      next: () => {
        this.deleteBusyId.set(null);
        this.data.update(current =>
          current ? { ...current, attachments: current.attachments.filter(item => item.id !== att.id) } : current,
        );
      },
      error: () => {
        this.deleteBusyId.set(null);
        this.deleteError.set('Verwijderen is mislukt. Probeer het opnieuw.');
      },
    });
  }

  protected stepClasses(active: boolean): string {
    return active
      ? 'bg-emerald-500 text-white ring-emerald-200'
      : 'bg-zinc-200 text-zinc-500 ring-zinc-200';
  }

  private load(token: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.service.getByToken(token).subscribe({
      next: data => {
        this.data.set(data);
        this.loading.set(false);
        this.patchPreferences(data.preferences);
      },
      error: err => {
        if (err?.status === 404 || err?.status === 410) {
          this.error.set('Deze link is verlopen of ongeldig.');
        } else {
          this.error.set('We konden je aanvraag niet laden. Probeer het later opnieuw.');
        }
        this.loading.set(false);
      },
    });
  }

  private patchPreferences(preferences: LeadPreferences): void {
    const { min, max } = this.parseBudget(preferences?.budget);
    this.preferencesForm.patchValue({
      budgetMin: min,
      budgetMax: max,
      timeframe: preferences?.timeframe ?? '',
      availability: preferences?.availability ?? '',
      extraNotes: preferences?.extraNotes ?? '',
    });
  }

  private initTimeframeSelection(): void {
    const current = (this.preferencesForm.controls.timeframe.value ?? '').trim();
    if (!current) {
      this.timeframeSelection.set('');
      this.customTimeframe.set('');
      return;
    }

    const match = this.timeframeOptions.find(option => option.toLowerCase() === current.toLowerCase());
    if (match) {
      this.timeframeSelection.set(match);
      this.customTimeframe.set('');
      this.preferencesForm.controls.timeframe.setValue(match);
      return;
    }

    this.timeframeSelection.set('Anders');
    this.customTimeframe.set(current);
    this.preferencesForm.controls.timeframe.setValue(current);
  }

  private parseBudget(budget?: string): { min: string; max: string } {
    if (!budget) return { min: '', max: '' };
    const nums = budget.match(/[\d.]+/g)?.map(n => n.replaceAll('.', '')) ?? [];
    if (budget.includes('–') || budget.includes('-')) {
      return { min: nums[0] ?? '', max: nums[1] ?? '' };
    }
    if (budget.toLowerCase().startsWith('vanaf')) {
      return { min: nums[0] ?? '', max: '' };
    }
    if (budget.toLowerCase().startsWith('tot')) {
      return { min: '', max: nums[0] ?? '' };
    }
    return { min: nums[0] ?? '', max: '' };
  }

  private formatBudget(min: string, max: string): string {
    const fmt = (n: string) => Number(n).toLocaleString('nl-NL');
    const hasMin = !!min && Number(min) > 0;
    const hasMax = !!max && Number(max) > 0;
    if (hasMin && hasMax) return `€ ${fmt(min)} – € ${fmt(max)}`;
    if (hasMin) return `vanaf € ${fmt(min)}`;
    if (hasMax) return `tot € ${fmt(max)}`;
    return '';
  }

  private refreshData(token: string): void {
    this.service.getByToken(token).subscribe({
      next: data => {
        this.data.set(data);
        this.patchPreferences(data.preferences);
      },
    });
  }

  private uploadFile(file: File): void {
    const token = this.token();
    if (!token) return;

    this.uploadBusy.set(true);
    this.uploadError.set(null);
    this.uploadSuccess.set(false);

    const contentType = file.type || 'application/octet-stream';
    this.service.presignUpload(token, {
      fileName: file.name,
      contentType,
      sizeBytes: file.size,
    }).subscribe({
      next: presigned => {
        this.uploadToPresignedUrl(presigned.uploadUrl, file, contentType)
          .then(() => {
            this.service.confirmUpload(token, {
              fileKey: presigned.fileKey,
              fileName: file.name,
              contentType,
              sizeBytes: file.size,
            }).subscribe({
              next: () => {
                this.uploadBusy.set(false);
                this.uploadSuccess.set(true);
                this.refreshData(token);
              },
              error: () => {
                this.uploadBusy.set(false);
                this.uploadError.set('Uploaden is mislukt. Probeer het opnieuw.');
              },
            });
          })
          .catch(() => {
            this.uploadBusy.set(false);
            this.uploadError.set('Uploaden is mislukt. Probeer het opnieuw.');
          });
      },
      error: () => {
        this.uploadBusy.set(false);
        this.uploadError.set('Uploaden is mislukt. Probeer het opnieuw.');
      },
    });
  }

  private async uploadToPresignedUrl(url: string, file: File, contentType: string): Promise<void> {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
      },
      body: file,
    });

    if (!response.ok) {
      throw new Error('Upload failed');
    }
  }

  protected slotDisplayWeekday(date: string): string {
    return this.datePipe.transform(date, 'EEE', '', 'nl') ?? date;
  }

  protected slotDisplayDay(date: string): string {
    return this.datePipe.transform(date, 'd', '', 'nl') ?? date;
  }

  protected slotDisplayMonth(date: string): string {
    return this.datePipe.transform(date, 'MMM', '', 'nl') ?? '';
  }

  protected isSlotDateSelected(date: string): boolean {
    return this.selectedSlotDate() === date;
  }

  protected dayHasSlots(date: string): boolean {
    const slots = this.availableSlots() ?? [];
    return slots.some(day => day.date === date && day.slots.length > 0);
  }

  protected selectSlotDate(date: string): void {
    if (!this.dayHasSlots(date)) return;
    this.selectedSlotDate.set(date);
    this.selectedSlot.set(null);
  }

  protected selectSlot(slot: AvailableTimeSlot): void {
    this.selectedSlot.set(slot);
  }

  protected readonly selectedDaySlots = computed(() => {
    const date = this.selectedSlotDate();
    if (!date) return [] as AvailableTimeSlot[];
    const slots = this.availableSlots() ?? [];
    return slots.find(day => day.date === date)?.slots ?? [];
  });

  protected calendarIcsHref(appt: AppointmentSummary): string {
    const start = this.toIcsDate(appt.startTime);
    const end = this.toIcsDate(appt.endTime);
    const stamp = this.toIcsDate(new Date().toISOString());
    const title = (appt.title || 'Afspraak').replaceAll('\n', ' ').trim();
    const uid = `${appt.id}@lead-tracking`;

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Lead Track//Appointment//NL',
      'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${title}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
  }

  private loadAvailableSlots(): void {
    if (this.loadingSlots()) return;
    const token = this.token();
    if (!token) return;

    this.slotError.set(null);
    this.loadingSlots.set(true);
    this.availableSlots.set([]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dates = Array.from({ length: 14 }, (_, idx) => this.formatIsoDate(this.addDays(today, idx)));
    const startDate = dates.at(0);
    const endDate = dates.at(-1);
    if (!startDate || !endDate) {
      this.loadingSlots.set(false);
      return;
    }
    this.slotDates.set(dates);
    this.selectedSlotDate.set(startDate ?? null);

    this.service.getAvailableSlots(token, startDate, endDate).subscribe({
      next: response => {
        const days = response?.days ?? [];
        this.availableSlots.set(days);
        if (!this.dayHasSlots(this.selectedSlotDate() ?? '')) {
          const firstWithSlots = days.find(day => day.slots.length > 0)?.date;
          this.selectedSlotDate.set(firstWithSlots ?? null);
        }
        this.loadingSlots.set(false);
      },
      error: () => {
        this.loadingSlots.set(false);
        this.slotError.set('We konden geen tijden laden. Probeer het opnieuw.');
      },
    });
  }

  private requestAppointment(): void {
    if (this.requestingAppointment()) return;
    const token = this.token();
    if (!token) return;
    const slot = this.selectedSlot();
    if (!slot) {
      this.slotError.set('Kies een tijdvak om je afspraak aan te vragen.');
      return;
    }

    this.slotError.set(null);
    this.slotRequestSuccess.set(false);
    this.requestingAppointment.set(true);

    this.service.requestAppointment(token, { userId: slot.userId, startTime: slot.startTime, endTime: slot.endTime }).subscribe({
      next: response => {
        this.requestingAppointment.set(false);
        this.slotRequestSuccess.set(true);
        this.data.update(current => {
          if (!current) return current;
          const appointment = {
            ...response.appointment,
            status: response.appointment.status || 'requested',
          };
          const existing = current.appointments ?? [];
          const deduped = [appointment, ...existing.filter(item => item.id !== appointment.id)];
          return { ...current, appointmentRequest: appointment, appointments: deduped };
        });
      },
      error: () => {
        this.requestingAppointment.set(false);
        this.slotError.set('Afspraak aanvragen mislukt. Probeer het opnieuw.');
      },
    });
  }

  private addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  private formatIsoDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private toIcsDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  }

}
