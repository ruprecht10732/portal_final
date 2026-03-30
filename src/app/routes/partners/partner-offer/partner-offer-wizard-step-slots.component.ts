import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { type TimeSlot } from '../../../core/services/partner-offer.types';
import { type PartnerOfferCalendarDay, type PartnerOfferSlotOption } from './partner-offer-wizard.types';

@Component({
  selector: 'app-partner-offer-wizard-step-slots',
  standalone: true,
  imports: [DatePipe, TranslatePipe],
  template: `
    <div class="typeform-step">
      <div class="typeform-step-number">4</div>
      <h3 class="text-xl font-extrabold tracking-tight text-zinc-900">{{ 'partners.offer.wizard.slotsHeading' | translate }}</h3>
      <p class="mt-2 text-sm text-zinc-500">{{ 'partners.offer.wizard.slotsBody' | translate }}</p>

      @if (requiresInspection()) {
        <div class="mt-6">
          <h4 class="mb-3 text-sm font-bold text-zinc-900">
            {{ 'partners.offer.accept.title' | translate }}
            @if (inspectionSlots().length > 0) {
              <span class="ml-2 inline-flex items-center rounded-full bg-teal-100 px-2 py-0.5 text-xs font-semibold text-teal-700">{{ inspectionSlots().length }}</span>
            }
          </h4>

          <div class="calendar-card">
            <div class="calendar-header">
              <button type="button" class="calendar-nav" (click)="changeInspectionMonth.emit(-1)">&lsaquo;</button>
              <span>{{ inspectionMonth() | date:'MMMM yyyy':'':'nl-NL' }}</span>
              <button type="button" class="calendar-nav" (click)="changeInspectionMonth.emit(1)">&rsaquo;</button>
            </div>
            <div class="calendar-grid">
              <span class="calendar-weekday">Ma</span><span class="calendar-weekday">Di</span><span class="calendar-weekday">Wo</span><span class="calendar-weekday">Do</span><span class="calendar-weekday">Vr</span><span class="calendar-weekday">Za</span><span class="calendar-weekday">Zo</span>
              @for (day of inspectionCalendarDays(); track day.key) {
                <button type="button" class="calendar-day" [class.is-outside]="!day.isCurrentMonth" [class.is-today]="day.isToday" [class.is-selected]="selectedInspectionDate() === day.date" [class.is-disabled]="isPastDate(day.date)" [class.has-slots]="dateHasSlots(day.date, inspectionSlots())" [disabled]="isPastDate(day.date)" (click)="selectInspectionDate.emit(day.date)">{{ day.label }}</button>
              }
            </div>
          </div>

          @if (selectedInspectionDate()) {
            <div class="time-panel mt-4">
              <p class="mb-3 text-xs font-semibold text-zinc-500">{{ 'partners.offer.accept.selectSlotHint' | translate }}</p>
              <div class="slot-grid">
                @for (slot of slotOptions(); track slot.start) {
                  <button type="button" class="slot-button" [class.is-selected]="isSlotActive(selectedInspectionDate(), slot.start, inspectionSlots())" [class.is-disabled]="isPastSlot(selectedInspectionDate(), slot.start)" [disabled]="isPastSlot(selectedInspectionDate(), slot.start)" (click)="toggleInspectionSlot.emit(slot.start)">
                    {{ slot.label }}
                  </button>
                }
              </div>
            </div>
          } @else {
            <p class="mt-3 text-xs font-medium text-zinc-500">{{ 'partners.offer.accept.selectDateHint' | translate }}</p>
          }

          @if (inspectionSlots().length > 0) {
            <div class="slot-list mt-4">
              @for (slot of inspectionSlots(); track $index) {
                <div class="slot-chip"><span>{{ formatSlotLabel(slot) }}</span><button type="button" (click)="removeInspectionSlot.emit($index)" aria-label="remove">&times;</button></div>
              }
            </div>
          }

          @if (inspectionErrors().length > 0) {
            <div class="validation-list">@for (err of inspectionErrors(); track err) { <p>{{ err | translate }}</p> }</div>
          }
        </div>
      }

      <div class="mt-6 border-t border-zinc-100 pt-5">
        <h4 class="mb-3 text-sm font-bold text-zinc-900">
          {{ 'partners.offer.accept.jobTitle' | translate }}
          <span class="text-xs font-normal text-zinc-400">{{ 'partners.offer.accept.optional' | translate }}</span>
          @if (jobSlots().length > 0) {
            <span class="ml-2 inline-flex items-center rounded-full bg-teal-100 px-2 py-0.5 text-xs font-semibold text-teal-700">{{ jobSlots().length }}</span>
          }
        </h4>

        <div class="calendar-card">
          <div class="calendar-header">
            <button type="button" class="calendar-nav" (click)="changeJobMonth.emit(-1)">&lsaquo;</button>
            <span>{{ jobMonth() | date:'MMMM yyyy':'':'nl-NL' }}</span>
            <button type="button" class="calendar-nav" (click)="changeJobMonth.emit(1)">&rsaquo;</button>
          </div>
          <div class="calendar-grid">
            <span class="calendar-weekday">Ma</span><span class="calendar-weekday">Di</span><span class="calendar-weekday">Wo</span><span class="calendar-weekday">Do</span><span class="calendar-weekday">Vr</span><span class="calendar-weekday">Za</span><span class="calendar-weekday">Zo</span>
            @for (day of jobCalendarDays(); track day.key) {
              <button type="button" class="calendar-day" [class.is-outside]="!day.isCurrentMonth" [class.is-today]="day.isToday" [class.is-selected]="selectedJobDate() === day.date" [class.is-disabled]="isPastDate(day.date)" [class.has-slots]="dateHasSlots(day.date, jobSlots())" [disabled]="isPastDate(day.date)" (click)="selectJobDate.emit(day.date)">{{ day.label }}</button>
            }
          </div>
        </div>

        @if (selectedJobDate()) {
          <div class="time-panel mt-4">
            <p class="mb-3 text-xs font-semibold text-zinc-500">{{ 'partners.offer.accept.selectSlotHint' | translate }}</p>
            <div class="slot-grid">
              @for (slot of slotOptions(); track slot.start) {
                <button type="button" class="slot-button" [class.is-selected]="isSlotActive(selectedJobDate(), slot.start, jobSlots())" [class.is-disabled]="isPastSlot(selectedJobDate(), slot.start)" [disabled]="isPastSlot(selectedJobDate(), slot.start)" (click)="toggleJobSlot.emit(slot.start)">
                  {{ slot.label }}
                </button>
              }
            </div>
          </div>
        } @else {
          <p class="mt-3 text-xs font-medium text-zinc-500">{{ 'partners.offer.accept.selectDateHint' | translate }}</p>
        }

        @if (jobSlots().length > 0) {
          <div class="slot-list mt-4">
            @for (slot of jobSlots(); track $index) {
              <div class="slot-chip"><span>{{ formatSlotLabel(slot) }}</span><button type="button" (click)="removeJobSlot.emit($index)" aria-label="remove">&times;</button></div>
            }
          </div>
        }

        @if (jobErrors().length > 0) {
          <div class="validation-list">@for (err of jobErrors(); track err) { <p>{{ err | translate }}</p> }</div>
        }
      </div>
    </div>
  `,
  styleUrl: './partner-offer-wizard-step.shared.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartnerOfferWizardStepSlotsComponent {
  readonly requiresInspection = input(true);
  readonly inspectionMonth = input.required<Date>();
  readonly inspectionCalendarDays = input.required<PartnerOfferCalendarDay[]>();
  readonly selectedInspectionDate = input<string | null>(null);
  readonly inspectionSlots = input.required<TimeSlot[]>();
  readonly inspectionErrors = input.required<string[]>();

  readonly jobMonth = input.required<Date>();
  readonly jobCalendarDays = input.required<PartnerOfferCalendarDay[]>();
  readonly selectedJobDate = input<string | null>(null);
  readonly jobSlots = input.required<TimeSlot[]>();
  readonly jobErrors = input.required<string[]>();
  readonly slotOptions = input.required<PartnerOfferSlotOption[]>();

  readonly changeInspectionMonth = output<number>();
  readonly selectInspectionDate = output<string>();
  readonly toggleInspectionSlot = output<string>();
  readonly removeInspectionSlot = output<number>();
  readonly changeJobMonth = output<number>();
  readonly selectJobDate = output<string>();
  readonly toggleJobSlot = output<string>();
  readonly removeJobSlot = output<number>();

  protected isPastDate(dateStr: string): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const date = new Date(`${dateStr}T00:00:00`);
    return date < today;
  }

  protected isPastSlot(dateStr: string | null, startTime: string): boolean {
    if (!dateStr) return true;
    if (this.isPastDate(dateStr)) return true;
    const normalizedTime = startTime.length === 5 ? `${startTime}:00` : startTime;
    const startDate = new Date(`${dateStr}T${normalizedTime}`);
    if (Number.isNaN(startDate.getTime())) return true;
    return startDate <= new Date();
  }

  protected dateHasSlots(date: string, slots: TimeSlot[]): boolean {
    return slots.some((slot) => slot.start.startsWith(`${date}T`));
  }

  protected isSlotActive(date: string | null, startTime: string, slots: TimeSlot[]): boolean {
    if (!date) return false;
    return slots.some((slot) => slot.start.startsWith(`${date}T${startTime}`));
  }

  protected formatSlotLabel(slot: TimeSlot): string {
    const start = new Date(slot.start);
    const end = new Date(slot.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '';
    const dateLabel = start.toLocaleDateString('nl-NL', { weekday: 'short', day: '2-digit', month: 'short' });
    const startTime = start.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
    const endTime = end.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
    return `${dateLabel} · ${startTime} - ${endTime}`;
  }
}