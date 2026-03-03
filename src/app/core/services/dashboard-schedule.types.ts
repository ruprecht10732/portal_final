import type { AppointmentResponse } from './appointments.types';

/** A group of appointments for a single day. */
export interface ScheduleDayGroup {
  /** ISO date string YYYY-MM-DD. */
  date: string;
  /** Human-readable label e.g. "Vandaag", "Morgen", "za 8 feb". */
  label: string;
  /** Appointments for this day, sorted by startTime ascending. */
  appointments: AppointmentResponse[];
}
