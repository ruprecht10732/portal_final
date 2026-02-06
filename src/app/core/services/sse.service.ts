import { DestroyRef, inject, Injectable, NgZone, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ToastService } from './toast.service';
import { TokenStorageService } from './token-storage.service';

// SSE event types from the backend
export type SSEEventType =
  | 'analysis_complete'
  | 'photo_analysis_complete'
  | 'lead_updated'
  | 'quote_viewed'
  | 'quote_item_toggled'
  | 'quote_annotated'
  | 'quote_accepted'
  | 'quote_rejected';

// Base SSE event structure from the backend
export interface SSEEvent {
  type: SSEEventType;
  leadId?: string;
  serviceId?: string;
  message?: string;
  data?: Record<string, unknown>;
  timestamp?: string;
}

// Photo analysis specific event data
export interface PhotoAnalysisEventData {
  success: boolean;
  analysis?: {
    id: string;
    leadId: string;
    serviceId: string;
    summary: string;
    observations: string[];
    scopeAssessment: string;
    costIndicators: string;
    safetyConcerns?: string[];
    additionalInfo?: string[];
    photoCount: number;
    confidenceLevel: string;
  };
  error?: string;
}

export interface SSEConnectionState {
  connected: boolean;
  reconnectAttempts: number;
  lastError?: string;
}

@Injectable({ providedIn: 'root' })
export class SSEService {
  private readonly tokens = inject(TokenStorageService);
  private readonly toast = inject(ToastService);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  private eventSource: EventSource | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly maxReconnectAttempts = 5;
  private readonly baseReconnectDelay = 1000; // 1 second

  // Connection state
  private readonly connectionState = signal<SSEConnectionState>({
    connected: false,
    reconnectAttempts: 0,
  });

  // Event subjects for different event types
  private readonly photoAnalysisComplete$ = new Subject<SSEEvent & { data: PhotoAnalysisEventData }>();
  private readonly leadUpdated$ = new Subject<SSEEvent>();
  private readonly allEvents$ = new Subject<SSEEvent>();

  readonly state = this.connectionState.asReadonly();
  readonly photoAnalysisComplete = this.photoAnalysisComplete$.asObservable();
  readonly leadUpdated = this.leadUpdated$.asObservable();
  readonly events = this.allEvents$.asObservable();

  constructor() {
    // Auto-connect when service is instantiated
    this.connect();

    // Subscribe to photo analysis events and show toasts
    this.photoAnalysisComplete
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(event => this.handlePhotoAnalysisEvent(event));
  }

  /**
   * Connect to the SSE endpoint
   */
  connect(): void {
    if (this.eventSource) {
      return; // Already connected
    }

    const token = this.tokens.accessTokenValue;
    if (!token) {
      // Not authenticated, skip connection
      return;
    }

    const url = `${environment.apiBaseUrl}/events?token=${encodeURIComponent(token)}`;

    this.zone.runOutsideAngular(() => {
      try {
        this.eventSource = new EventSource(url);

        this.eventSource.onopen = () => {
          this.zone.run(() => {
            this.connectionState.set({
              connected: true,
              reconnectAttempts: 0,
            });
          });
        };

        this.eventSource.onmessage = (event) => {
          this.zone.run(() => {
            this.handleEventMessage(event);
          });
        };

        this.eventSource.addEventListener('photo_analysis_complete', (event) => {
          this.zone.run(() => {
            this.handleEventMessage(event, 'photo_analysis_complete');
          });
        });

        this.eventSource.addEventListener('analysis_complete', (event) => {
          this.zone.run(() => {
            this.handleEventMessage(event, 'analysis_complete');
          });
        });

        this.eventSource.addEventListener('lead_updated', (event) => {
          this.zone.run(() => {
            this.handleEventMessage(event, 'lead_updated');
          });
        });

        // Quote events
        for (const evtType of ['quote_viewed', 'quote_item_toggled', 'quote_annotated', 'quote_accepted', 'quote_rejected'] as const) {
          this.eventSource.addEventListener(evtType, (event) => {
            this.zone.run(() => {
              this.handleEventMessage(event, evtType);
            });
          });
        }

        this.eventSource.onerror = () => {
          this.zone.run(() => {
            this.handleConnectionError();
          });
        };
      } catch (e) {
        console.error('Failed to create EventSource:', e);
        this.scheduleReconnect();
      }
    });
  }

  /**
   * Disconnect from the SSE endpoint
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.connectionState.set({
      connected: false,
      reconnectAttempts: 0,
    });
  }

  /**
   * Reconnect to the SSE endpoint (e.g., after token refresh)
   */
  reconnect(): void {
    this.disconnect();
    this.connect();
  }

  private handleEventMessage(event: MessageEvent, overrideType?: SSEEventType): void {
    if (!event.data) return;

    try {
      const parsed = JSON.parse(event.data) as SSEEvent;
      const nextEvent = overrideType
        ? { ...parsed, type: overrideType }
        : parsed;
      this.dispatchEvent(nextEvent);
    } catch (e) {
      console.error('Failed to parse SSE event:', e);
    }
  }

  private dispatchEvent(event: SSEEvent): void {
    this.allEvents$.next(event);

    if (event.type === 'photo_analysis_complete') {
      this.photoAnalysisComplete$.next(event as SSEEvent & { data: PhotoAnalysisEventData });
    }
    if (event.type === 'lead_updated') {
      this.leadUpdated$.next(event);
    }
    // Add more event type handlers here as needed
  }

  private handlePhotoAnalysisEvent(event: SSEEvent & { data: PhotoAnalysisEventData }): void {
    const data = event.data;

    if (data.success && data.analysis) {
      // Show success toast with link to the lead
      this.toast.show({
        message: event.message || 'Foto-analyse voltooid',
        title: 'AI Analyse',
        variant: 'success',
        dismissible: true,
        durationMs: 10000, // 10 seconds - longer for important notifications
        link: {
          label: 'Bekijk analyse →',
          url: ['/leads', data.analysis.leadId],
        },
      });
    } else {
      this.toast.show({
        message: data.error || 'Foto-analyse mislukt',
        title: 'AI Analyse',
        variant: 'error',
        dismissible: true,
      });
    }
  }

  private handleConnectionError(): void {
    this.eventSource?.close();
    this.eventSource = null;

    const currentState = this.connectionState();
    this.connectionState.set({
      connected: false,
      reconnectAttempts: currentState.reconnectAttempts,
      lastError: 'Connection lost',
    });

    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    const currentState = this.connectionState();

    if (currentState.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('Max SSE reconnect attempts reached');
      return;
    }

    // Exponential backoff
    const delay = this.baseReconnectDelay * Math.pow(2, currentState.reconnectAttempts);

    this.connectionState.set({
      ...currentState,
      reconnectAttempts: currentState.reconnectAttempts + 1,
    });

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.tokens.accessTokenValue) {
        this.connect();
      }
    }, delay);
  }
}
