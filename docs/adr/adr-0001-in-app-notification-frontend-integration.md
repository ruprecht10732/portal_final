---
title: "ADR-0001: In-App Notification Frontend Integration"
status: "Proposed"
date: "2026-02-15"
authors: "Portal Development Team"
tags: ["architecture", "decision", "frontend", "notifications"]
supersedes: ""
superseded_by: ""
---

# ADR-0001: In-App Notification Frontend Integration

## Status

**Proposed**

## Context

The backend in-app notification system has been implemented with REST endpoints for CRUD operations and SSE (Server-Sent Events) for real-time delivery. The Angular frontend needs to consume these notifications to provide users with timely awareness of operational events (lead assignments, manual interventions, quote decisions, feed comments with @-mentions).

**Current Backend Integration Points:**
- **REST API**: `GET /notifications`, `GET /notifications/unread`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`
- **SSE Stream**: Event type `in_app_notification` pushed to `/api/v1/events?token={jwt}`
- **Authentication**: JWT via Bearer header or query parameter (for SSE)
- **Data Schema**: `{ id, title, content, category, resource_type, resource_id, is_read, created_at }`

**Frontend Architecture Context:**
- **HTTP Pattern**: HttpClient with dependency injection, environment-based base URLs, RxJS observables
- **SSE Infrastructure**: Existing `SSEService` with auto-reconnect, event-type routing, zone-aware execution
- **State Management**: Angular signals for reactive state (v16+ pattern)
- **Service Pattern**: Root-level injectable services with single responsibility
- **Toast System**: Existing `ToastService` for ephemeral user feedback

**Design Forces:**
- Need real-time notification delivery without polling overhead
- Must support unread count badge in app shell navigation
- Should allow marking individual or all notifications as read
- Need persistent notification list UI accessible from any route
- Must handle SSE reconnection without losing notification state
- Should integrate with existing authentication and token refresh flow
- Need to balance server-side persistent storage with client-side reactive state

## Decision

We will implement a **layered notification integration** with the following components:

### 1. Types Layer (`src/app/core/services/notifications.types.ts`)

Define TypeScript interfaces matching backend schema:

```typescript
export type NotificationCategory = 'info' | 'success' | 'warning' | 'error';

export interface InAppNotification {
  id: string;
  title: string;
  content: string;
  category: NotificationCategory;
  resourceType: string | null;
  resourceId: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationListResponse {
  notifications: InAppNotification[];
  page: number;
  limit: number;
  total: number;
}
```

### 2. HTTP Service Layer (`src/app/core/services/notifications.service.ts`)

Create a stateful service managing both REST API calls and local reactive state:

```typescript
@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/notifications`;
  
  // Reactive state
  private readonly notificationsSignal = signal<InAppNotification[]>([]);
  private readonly unreadCountSignal = signal<number>(0);
  private readonly loadingSignal = signal<boolean>(false);
  
  readonly notifications = this.notificationsSignal.asReadonly();
  readonly unreadCount = this.unreadCountSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();

  // REST operations
  list(page = 1, limit = 20): Observable<NotificationListResponse> { ... }
  getUnreadCount(): Observable<{ count: number }> { ... }
  markAsRead(id: string): Observable<void> { ... }
  markAllAsRead(): Observable<void> { ... }
  
  // State management
  loadNotifications(page = 1, limit = 20): void { ... }
  refreshUnreadCount(): void { ... }
  prependNotification(notification: InAppNotification): void { ... }
  updateNotificationReadStatus(id: string, isRead: boolean): void { ... }
}
```

**Key Characteristics:**
- **POS-001**: Signal-based reactive state ensures automatic UI updates when notifications change
- **POS-002**: Separation of HTTP operations (Observable returns) from state mutations enables flexible consumption patterns
- **POS-003**: `prependNotification()` method allows SSE integration to add incoming notifications without full refresh
- **NEG-001**: Dual state management (signals + server persistence) requires careful synchronization logic
- **NEG-002**: In-memory signal state is lost on page refresh—requires `loadNotifications()` call on service initialization

### 3. SSE Integration (Extend `src/app/core/services/sse.service.ts`)

Add `in_app_notification` event type and dispatch to NotificationsService:

```typescript
// In SSEService
export type SSEEventType =
  | 'in_app_notification'  // NEW
  | 'analysis_complete'
  | 'photo_analysis_complete'
  // ... existing types
  ;

private readonly inAppNotification$ = new Subject<SSEEvent>();
readonly inAppNotification = this.inAppNotification$.asObservable();

// In event listener setup
this.eventSource.addEventListener('in_app_notification', (event) => {
  this.zone.run(() => {
    this.handleEventMessage(event, 'in_app_notification');
  });
});

// In dispatchEvent()
if (event.type === 'in_app_notification') {
  this.inAppNotification$.next(event);
}
```

**Integration wiring** in NotificationsService constructor:

```typescript
constructor() {
  const sse = inject(SSEService);
  
  sse.inAppNotification
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe(event => {
      const notification = event.data?.['notification'] as InAppNotification | undefined;
      if (notification) {
        this.prependNotification(notification);
        this.unreadCountSignal.update(count => count + 1);
      }
    });
}
```

**Key Characteristics:**
- **POS-004**: Reuses existing SSE infrastructure with proven reconnection logic and zone handling
- **POS-005**: Zone-aware execution ensures Angular change detection triggers on SSE events
- **NEG-003**: SSE connection is token-dependent—requires reconnection logic on token refresh (already handled in existing SSEService)

### 4. UI Component Layer

#### 4.1 Notification Bell Button (`src/app/shared/components/notification-bell/`)

Positioned in app shell navigation bar:

```typescript
@Component({
  selector: 'app-notification-bell',
  standalone: true,
  template: `
    <button (click)="togglePanel()" class="relative">
      <icon name="bell" />
      @if (unreadCount() > 0) {
        <span class="badge">{{ unreadCount() }}</span>
      }
    </button>
    
    @if (isPanelOpen()) {
      <app-notification-panel 
        (close)="isPanelOpen.set(false)" 
      />
    }
  `
})
export class NotificationBellComponent {
  private readonly notificationsService = inject(NotificationsService);
  
  readonly unreadCount = this.notificationsService.unreadCount;
  readonly isPanelOpen = signal(false);
  
  togglePanel() { this.isPanelOpen.update(v => !v); }
}
```

**Key Characteristics:**
- **POS-006**: Badge visibility tied directly to signal-based unread count—no manual subscription management
- **POS-007**: Standalone component with minimal dependencies enables easy repositioning if needed

#### 4.2 Notification Panel (`src/app/shared/components/notification-panel/`)

Dropdown panel with notification list and actions:

```typescript
@Component({
  selector: 'app-notification-panel',
  standalone: true,
  template: `
    <div class="panel">
      <div class="header">
        <h3>Meldingen</h3>
        @if (unreadCount() > 0) {
          <button (click)="markAllRead()">Alles als gelezen markeren</button>
        }
      </div>
      
      @if (loading()) {
        <spinner />
      } @else if (notifications().length === 0) {
        <empty-state message="Geen meldingen" />
      } @else {
        <ul>
          @for (notification of notifications(); track notification.id) {
            <li [class.unread]="!notification.isRead" (click)="handleClick(notification)">
              <div class="category-badge" [attr.data-category]="notification.category"></div>
              <div>
                <h4>{{ notification.title }}</h4>
                <p>{{ notification.content }}</p>
                <time>{{ notification.createdAt | relativeTime }}</time>
              </div>
            </li>
          }
        </ul>
      }
    </div>
  `
})
export class NotificationPanelComponent {
  private readonly notificationsService = inject(NotificationsService);
  private readonly router = inject(Router);
  
  readonly notifications = this.notificationsService.notifications;
  readonly unreadCount = this.notificationsService.unreadCount;
  readonly loading = this.notificationsService.loading;
  
  @Output() close = new EventEmitter<void>();
  
  ngOnInit() {
    this.notificationsService.loadNotifications(1, 10); // Load first 10 on open
  }
  
  async handleClick(notification: InAppNotification) {
    if (!notification.isRead) {
      this.notificationsService.markAsRead(notification.id);
    }
    
    if (notification.resourceType && notification.resourceId) {
      const route = this.mapResourceToRoute(notification.resourceType, notification.resourceId);
      if (route) {
        await this.router.navigate(route);
        this.close.emit();
      }
    }
  }
  
  markAllRead() {
    this.notificationsService.markAllAsRead();
  }
  
  private mapResourceToRoute(type: string, id: string): string[] | null {
    const routes: Record<string, string[]> = {
      'lead': ['/app/leads', id],
      'quote': ['/app/offertes', id],
      'appointment': ['/app/afspraken', id],
      'lead_feed': ['/app/leads', id], // Navigate to lead detail, feed tab auto-selected if needed
    };
    return routes[type] ?? null;
  }
}
```

**Key Characteristics:**
- **POS-008**: Click-to-navigate pattern provides seamless UX for contextual notification actions
- **POS-009**: Auto-marking unread notifications as read on click reduces manual effort
- **POS-010**: Resource type mapping enables generic notification creation without frontend coupling
- **NEG-004**: Limited to 10 notifications in panel—requires "View all" link to dedicated page for full history
- **NEG-005**: No pagination UI in panel—subsequent notifications require dedicated page

#### 4.3 Full Notification Page (Optional for v2)

Route: `/app/notifications`

Provides paginated list, filtering by category, and bulk actions. **Not required for initial rollout** but recommended for power users.

### 5. Initialization Sequence

```
App Startup
  ↓
SSEService constructor → connect() [existing]
  ↓
NotificationsService constructor → subscribe to SSE inAppNotification$
  ↓
App Shell renders NotificationBellComponent
  ↓
NotificationsService.refreshUnreadCount() [called in app.ts init or route guard]
  ↓
User clicks bell → NotificationPanelComponent.ngOnInit() → loadNotifications(1, 10)
  ↓
SSE event arrives → prependNotification() → unreadCount++
  ↓
User clicks notification → markAsRead() → navigate → close panel
```

**Key Characteristics:**
- **POS-011**: Lazy loading notifications on bell click avoids unnecessary API calls for users who don't check notifications
- **NEG-006**: Unread count must be fetched eagerly on app load—adds one extra HTTP request to initialization sequence

### 6. Error Handling

```typescript
// In NotificationsService
markAsRead(id: string): Observable<void> {
  return this.http.patch<void>(`${this.baseUrl}/${id}/read`, {}).pipe(
    tap(() => this.updateNotificationReadStatus(id, true)),
    catchError(error => {
      // Revert optimistic update
      this.updateNotificationReadStatus(id, false);
      return throwError(() => error);
    })
  );
}
```

**Strategy**: Optimistic UI updates with rollback on failure.

**Key Characteristics:**
- **POS-012**: Immediate UI feedback improves perceived performance
- **NEG-007**: Network failures can cause temporary state inconsistency until rollback completes

## Consequences

### Positive

- **POS-001**: Signal-based reactive state ensures automatic UI updates when notifications change
- **POS-002**: Separation of HTTP operations from state mutations enables flexible consumption patterns
- **POS-003**: `prependNotification()` method allows SSE integration to add incoming notifications without full refresh
- **POS-004**: Reuses existing SSE infrastructure with proven reconnection logic and zone handling
- **POS-005**: Zone-aware execution ensures Angular change detection triggers on SSE events
- **POS-006**: Badge visibility tied directly to signal-based unread count—no manual subscription management
- **POS-007**: Standalone component with minimal dependencies enables easy repositioning if needed
- **POS-008**: Click-to-navigate pattern provides seamless UX for contextual notification actions
- **POS-009**: Auto-marking unread notifications as read on click reduces manual effort
- **POS-010**: Resource type mapping enables generic notification creation without frontend coupling
- **POS-011**: Lazy loading notifications on bell click avoids unnecessary API calls for users who don't check notifications
- **POS-012**: Optimistic UI updates improve perceived performance

### Negative

- **NEG-001**: Dual state management (signals + server persistence) requires careful synchronization logic
- **NEG-002**: In-memory signal state is lost on page refresh—requires `loadNotifications()` call on service initialization
- **NEG-003**: SSE connection is token-dependent—requires reconnection logic on token refresh (already handled)
- **NEG-004**: Limited to 10 notifications in panel—requires "View all" link to dedicated page for full history
- **NEG-005**: No pagination UI in panel—subsequent notifications require dedicated page
- **NEG-006**: Unread count must be fetched eagerly on app load—adds one extra HTTP request to initialization sequence
- **NEG-007**: Network failures can cause temporary state inconsistency until optimistic update rollback completes

## Alternatives Considered

### Alternative A: Polling-Based Notification Retrieval

- **ALT-001**: **Description**: Use `interval(30000)` to poll `GET /notifications/unread` and refresh notification list every 30 seconds instead of SSE
- **ALT-002**: **Rejection Reason**: Introduces unnecessary server load (N users × 2 requests/minute = high RPS for idle data), increases latency for notification delivery (up to 30s delay), and duplicates infrastructure when SSE already exists and handles other real-time events

### Alternative B: Dedicated Notification Store (NgRx/Akita)

- **ALT-003**: **Description**: Implement a formal state management library (NgRx Store or Akita) to manage notification state with actions, reducers, and selectors
- **ALT-004**: **Rejection Reason**: Adds significant complexity and bundle size for a single feature; Angular signals provide sufficient reactivity for this use case; no need for time-travel debugging or complex state orchestration for notifications

### Alternative C: Push Notification API (Browser Notifications)

- **ALT-005**: **Description**: Use browser `Notification` API to show OS-level notifications in addition to in-app badges
- **ALT-006**: **Rejection Reason**: Requires user permission prompt (low acceptance rate), not suitable for high-frequency operational notifications (would spam users), and doesn't replace need for in-app persistent notification list; better suited for critical alerts only (future enhancement)

## Implementation Notes

- **IMP-001**: Create types file first to establish contract between backend and frontend
- **IMP-002**: Implement NotificationsService with unit tests for state management logic before UI components
- **IMP-003**: Add `in_app_notification` SSE event type to SSEService with minimal changes to existing code
- **IMP-004**: Integrate NotificationBellComponent into app shell navigation bar (right side, before user menu)
- **IMP-005**: Monitor unread count API performance during rollout—consider caching strategy if query becomes expensive at scale
- **IMP-006**: Add Cypress E2E tests for notification flow: receive SSE event → badge updates → click bell → panel opens → click notification → navigate to resource
- **IMP-007**: Document resource type mapping convention for backend developers creating new notification types

## References

- **REF-001**: [Backend ADR for In-App Notification System](../../portal_final_backend/docs/adr/adr-NNNN-in-app-notifications.md) (placeholder—create if needed)
- **REF-002**: [Angular Signals Documentation](https://angular.io/guide/signals)
- **REF-003**: [SSE (Server-Sent Events) Specification](https://html.spec.whatwg.org/multipage/server-sent-events.html)
- **REF-004**: Existing `SSEService` implementation: [src/app/core/services/sse.service.ts](../../../src/app/core/services/sse.service.ts)
- **REF-005**: [Backend Notification REST API](../../portal_final_backend/internal/notification/handler/http_handler.go)
- **REF-006**: [Backend SSE Integration](../../portal_final_backend/internal/notification/service.go#SetSSE)
