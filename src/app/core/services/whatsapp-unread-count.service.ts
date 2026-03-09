import { Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, filter, interval, map, of, startWith, switchMap } from 'rxjs';
import { SSEService } from './sse.service';
import { WhatsAppInboxService } from './whatsapp-inbox.service';

@Injectable({ providedIn: 'root' })
export class WhatsAppUnreadCountService {
  private readonly inbox = inject(WhatsAppInboxService);
  private readonly sse = inject(SSEService);

  private readonly unreadCountState = signal(0);
  readonly unreadCount = this.unreadCountState.asReadonly();

  constructor() {
    interval(60000)
      .pipe(
        startWith(0),
        switchMap(() => this.fetchUnreadCount()),
        takeUntilDestroyed(),
      )
      .subscribe(count => this.unreadCountState.set(count));

    this.sse.events
      .pipe(
        filter(event => event.type === 'whatsapp_message_received' || event.type === 'whatsapp_conversation_updated'),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.refresh());
  }

  refresh(): void {
    this.fetchUnreadCount().subscribe(count => this.unreadCountState.set(count));
  }

  private fetchUnreadCount() {
    return this.inbox.getUnreadConversationCount().pipe(
      map(response => response.count),
      catchError(() => of(0)),
    );
  }
}