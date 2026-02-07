import { DestroyRef, inject, Injectable, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SSEService, type SSEEvent } from './sse.service';
import type { ActivityCategory, ActivityEvent } from './dashboard-activity.types';

/** Maximum number of events kept in the feed (newest first). */
const MAX_EVENTS = 100;

/**
 * Service that aggregates SSE events into a unified activity feed
 * for the dashboard widget.
 */
@Injectable({ providedIn: 'root' })
export class DashboardActivityService {
  private readonly sse = inject(SSEService);
  private readonly destroyRef = inject(DestroyRef);

  /** Internal mutable list — newest first. */
  private readonly _events = signal<ActivityEvent[]>([]);

  /** Active filter categories (empty = show all). */
  private readonly _filters = signal<Set<ActivityCategory>>(new Set());

  /** All collected events. */
  readonly events = this._events.asReadonly();

  /** Currently active filters. */
  readonly filters = this._filters.asReadonly();

  /** Filtered view of events based on active category filters. */
  readonly filteredEvents = computed(() => {
    const active = this._filters();
    const all = this._events();
    if (active.size === 0) return all;
    return all.filter(e => active.has(e.category));
  });

  constructor() {
    this.subscribeToSSE();
  }

  /** Toggle a category filter on/off. */
  toggleFilter(category: ActivityCategory): void {
    this._filters.update(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }

  /** Clear all filters (show all events). */
  clearFilters(): void {
    this._filters.set(new Set());
  }

  // ---------------------------------------------------------------------------
  // SSE subscription
  // ---------------------------------------------------------------------------

  private subscribeToSSE(): void {
    this.sse.events
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(event => {
        const mapped = this.mapEvent(event);
        if (!mapped) return;

        this._events.update(prev => {
          const next = [mapped, ...prev];
          return next.length > MAX_EVENTS ? next.slice(0, MAX_EVENTS) : next;
        });
      });
  }

  // ---------------------------------------------------------------------------
  // Event mapping
  // ---------------------------------------------------------------------------

  private mapEvent(raw: SSEEvent): ActivityEvent | null {
    const base: Omit<ActivityEvent, 'category' | 'title' | 'link'> = {
      id: crypto.randomUUID(),
      type: raw.type,
      timestamp: raw.timestamp ?? new Date().toISOString(),
      data: raw.data,
    };

    switch (raw.type) {
      // --- Lead events ---
      case 'lead_updated':
        return {
          ...base,
          category: 'leads',
          title: raw.message || 'Lead bijgewerkt',
          link: raw.leadId ? ['/app/leads', raw.leadId] : undefined,
        };

      // --- AI events ---
      case 'analysis_complete':
        return {
          ...base,
          category: 'ai',
          title: raw.message || 'Gatekeeper analyse voltooid',
          link: raw.leadId ? ['/app/leads', raw.leadId] : undefined,
        };
      case 'photo_analysis_complete':
        return {
          ...base,
          category: 'ai',
          title: raw.message || 'Foto-analyse voltooid',
          link: raw.leadId ? ['/app/leads', raw.leadId] : undefined,
        };

      // --- Quote events ---
      case 'quote_sent':
        return {
          ...base,
          category: 'quotes',
          title: 'Offerte verstuurd',
          link: this.quoteLink(raw),
        };
      case 'quote_viewed':
        return {
          ...base,
          category: 'quotes',
          title: 'Offerte bekeken door klant',
          link: this.quoteLink(raw),
        };
      case 'quote_accepted': {
        const payload = raw.data?.['payload'] as Record<string, unknown> | undefined;
        const name = (payload?.['signatureName'] as string) || 'klant';
        const cents = payload?.['totalCents'] as number | undefined;
        const amount = cents == null ? '' : this.formatCents(cents);
        return {
          ...base,
          category: 'quotes',
          title: `Offerte geaccepteerd door ${name}` + (amount ? ` voor ${amount}` : ''),
          link: this.quoteLink(raw),
        };
      }
      case 'quote_rejected':
        return {
          ...base,
          category: 'quotes',
          title: 'Offerte afgewezen door klant',
          link: this.quoteLink(raw),
        };
      case 'quote_item_toggled':
      case 'quote_annotated':
        return {
          ...base,
          category: 'quotes',
          title: raw.type === 'quote_annotated' ? 'Nieuwe vraag op offerte' : 'Offerte optie gewijzigd',
          link: this.quoteLink(raw),
        };

      // --- Appointment events ---
      case 'appointment_created': {
        const d = raw.data;
        const title = (d?.['title'] as string) || 'Nieuwe afspraak';
        return {
          ...base,
          category: 'appointments',
          title: `Nieuwe afspraak: ${title}`,
          description: this.appointmentLeadLabel(d),
          link: ['/app/appointments'],
        };
      }
      case 'appointment_updated': {
        const d = raw.data;
        const title = (d?.['title'] as string) || 'Afspraak';
        return {
          ...base,
          category: 'appointments',
          title: `Afspraak bijgewerkt: ${title}`,
          description: this.appointmentLeadLabel(d),
          link: ['/app/appointments'],
        };
      }
      case 'appointment_status_changed': {
        const d = raw.data;
        const title = (d?.['title'] as string) || 'Afspraak';
        const status = (d?.['status'] as string) || '';
        return {
          ...base,
          category: 'appointments',
          title: `${title}: ${this.translateStatus(status)}`,
          description: this.appointmentLeadLabel(d),
          link: ['/app/appointments'],
        };
      }

      default:
        return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private quoteLink(raw: SSEEvent): string[] | undefined {
    const quoteId = raw.data?.['quoteId'] as string | undefined;
    return quoteId ? ['/app/offertes', quoteId] : undefined;
  }

  private appointmentLeadLabel(data: Record<string, unknown> | undefined): string | undefined {
    const lead = data?.['lead'] as Record<string, unknown> | undefined;
    if (!lead) return undefined;
    const name = [lead['firstName'], lead['lastName']].filter(Boolean).join(' ');
    const address = lead['address'] as string | undefined;
    return [name, address].filter(Boolean).join(' — ');
  }

  private translateStatus(status: string): string {
    const map: Record<string, string> = {
      scheduled: 'Gepland',
      completed: 'Voltooid',
      cancelled: 'Geannuleerd',
      no_show: 'No-show',
    };
    return map[status] || status;
  }

  private formatCents(cents: number): string {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(cents / 100);
  }
}
