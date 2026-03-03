import { DestroyRef, inject, Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SSEService, type SSEEvent } from './sse.service';
import type { ActivityCategory, ActivityEvent } from './dashboard-activity.types';
import { environment } from '../../../environments/environment';

/** API response shape from GET /leads/activity-feed */
interface ActivityFeedItemDTO {
  id: string;
  type: string;
  category: ActivityCategory;
  title: string;
  description?: string;
  timestamp: string;
  link?: string[];
}

interface ActivityFeedResponse {
  items: ActivityFeedItemDTO[];
}

/** Maximum number of events kept in the feed (newest first). */
const MAX_EVENTS = 100;

/**
 * Service that aggregates SSE events into a unified activity feed
 * for the dashboard widget.
 *
 * On construction it loads recent historical activity from the backend
 * so the card is never empty on first render.
 */
@Injectable({ providedIn: 'root' })
export class DashboardActivityService {
  private readonly sse = inject(SSEService);
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);

  /** Internal mutable list — newest first. */
  private readonly _events = signal<ActivityEvent[]>([]);

  /** Active filter categories (empty = show all). */
  private readonly _filters = signal<Set<ActivityCategory>>(new Set());

  /** Track IDs we already have to prevent SSE duplicates after initial load. */
  private readonly seenKeys = new Set<string>();

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
    this.loadInitialEvents();
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
  // Initial HTTP load
  // ---------------------------------------------------------------------------

  private loadInitialEvents(): void {
    this.http
      .get<ActivityFeedResponse>(`${environment.apiBaseUrl}/leads/activity-feed`)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const mapped = (res.items ?? [])
            .map((item): ActivityEvent => ({
              id: item.id,
              type: item.type,
              category: item.category,
              title: item.title,
              description: item.description,
              timestamp: item.timestamp,
              link: this.prefixLink(item.link),
            }));

          // Register as seen
          for (const e of mapped) {
            this.seenKeys.add(this.eventKey(e));
          }

          // Merge: keep any SSE events that arrived before the HTTP response,
          // then append historical events that aren't duplicates.
          this._events.update(prev => {
            const combined = [...prev];
            for (const e of mapped) {
              if (!prev.some(p => p.id === e.id)) {
                combined.push(e);
              }
            }
            // Re-sort newest first and cap
            combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            return combined.length > MAX_EVENTS ? combined.slice(0, MAX_EVENTS) : combined;
          });
        },
        error: () => {
          // Silently ignore — the feed will still work with SSE-only events
        },
      });
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

        // Dedup: skip if we already loaded this event from history
        const key = this.eventKey(mapped);
        if (this.seenKeys.has(key)) return;
        this.seenKeys.add(key);

        this._events.update(prev => {
          const next = [mapped, ...prev];
          return next.length > MAX_EVENTS ? next.slice(0, MAX_EVENTS) : next;
        });
      });
  }

  /** Build a dedup key from category + type + timestamp (coarse enough). */
  private eventKey(e: ActivityEvent): string {
    // Prefer a stable ID when available (HTTP history items have a backend-generated ID).
    // SSE events don't provide a stable event id today, so we fall back to a composite key.
    if (e.id) {
      return e.id;
    }

    const data = e.data ?? {};
    const entityId =
      (data['appointmentId'] as string | undefined) ||
      (data['quoteId'] as string | undefined) ||
      (data['leadId'] as string | undefined) ||
      '';

    return `${e.category}:${e.type}:${entityId}:${e.timestamp}`;
  }

  // ---------------------------------------------------------------------------
  // Event mapping
  // ---------------------------------------------------------------------------

  private mapEvent(raw: SSEEvent): ActivityEvent | null {
    const base: Omit<ActivityEvent, 'category' | 'title' | 'link'> = {
      id: crypto.randomUUID(),
      type: raw.type,
      timestamp: raw.timestamp ?? new Date().toISOString(),
      data: raw.data
        ? { ...raw.data, leadId: raw.leadId, serviceId: raw.serviceId }
        : { leadId: raw.leadId, serviceId: raw.serviceId },
    };

    switch (raw.type) {
      // --- Lead events ---
      case 'lead_updated':
        return {
          ...base,
          category: 'leads',
          title: raw.message || 'Lead bijgewerkt',
          link: raw.leadId ? this.prefixLink(['leads', raw.leadId]) : undefined,
        };

      // --- AI events ---
      case 'analysis_complete':
        return {
          ...base,
          category: 'ai',
          title: raw.message || 'Gatekeeper analyse voltooid',
          link: raw.leadId ? this.prefixLink(['leads', raw.leadId]) : undefined,
        };
      case 'photo_analysis_complete':
        return {
          ...base,
          category: 'ai',
          title: raw.message || 'Foto-analyse voltooid',
          link: raw.leadId ? this.prefixLink(['leads', raw.leadId]) : undefined,
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
          link: this.prefixLink(['appointments']),
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
          link: this.prefixLink(['appointments']),
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
          link: this.prefixLink(['appointments']),
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
    return quoteId ? this.prefixLink(['offertes', quoteId]) : undefined;
  }

  private prefixLink(link: string[] | undefined): string[] | undefined {
    if (!link || link.length === 0) {
      return link;
    }
    const [first] = link;
    if (!first) {
      return link;
    }
    if (first.startsWith('/')) {
      return link;
    }
    return ['/app', ...link];
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
