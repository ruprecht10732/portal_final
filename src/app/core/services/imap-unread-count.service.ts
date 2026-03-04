import { Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, interval, map, of, startWith, switchMap } from 'rxjs';
import { SSEService } from './sse.service';
import type { InAppNotification } from './notifications.types';
import { UserService } from './user.service';

@Injectable({ providedIn: 'root' })
export class IMAPUnreadCountService {
  private readonly userService = inject(UserService);
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

    this.sse.inAppNotification
      .pipe(takeUntilDestroyed())
      .subscribe(event => {
        const payload = event.data as Partial<InAppNotification>;
        if (payload.resourceType === 'imap_account') {
          this.refresh();
        }
      });
  }

  refresh(): void {
    this.fetchUnreadCount().subscribe(count => this.unreadCountState.set(count));
  }

  private fetchUnreadCount() {
    return this.userService.getIMAPUnreadCount().pipe(
      map(response => response.count),
      catchError(() => of(0)),
    );
  }
}