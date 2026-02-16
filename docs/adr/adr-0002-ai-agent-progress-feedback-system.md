---
title: "ADR-0002: AI Agent Progress Feedback System"
status: "Implemented"
date: "2026-02-15"
authors: "Portal Development Team"
tags: ["architecture", "decision", "backend", "frontend", "ai", "ux"]
supersedes: ""
superseded_by: ""
---

# ADR-0002: AI Agent Progress Feedback System

## Status

**Implemented**

## Implementation Delta (2026-02-16)

The implemented contract differs from the original proposal examples in this ADR.

- Quote generation start endpoint is `POST /api/v1/quotes/generate`.
- Job status endpoint is `GET /api/v1/quotes/generate-jobs/:id`.
- Accepted response shape is camelCase: `{ jobId, status }`.
- Job payload shape is camelCase (with frontend tolerant parsing for snake_case fallback).
- Active statuses in production are `pending | running | completed | failed` (frontend also tolerates `cancelled`).

## Context

The portal currently executes four AI-powered workflow agents (Gatekeeper, Estimator, Dispatcher, QuoteGenerator) to automate lead qualification, quote generation, and installer matching. These operations involve multiple LLM calls, business rule evaluation, and external API integrations, resulting in processing times ranging from 5-30 seconds for simple cases to 60+ seconds for complex multi-product quotes.

**Current User Experience Pain Points:**

1. **Blocking UI**: Quote generation is synchronous—users see a generic loading spinner and cannot navigate away without canceling the operation
2. **Zero Visibility**: No indication of which processing step is executing (analyzing products vs. calculating prices vs. generating document)
3. **Perceived Slowness**: Long waits with no feedback feel longer than they are
4. **Lost Context**: If a user accidentally navigates away mid-process, work is lost and must restart
5. **No Closure**: Users don't know when an operation completes if they've switched to another task

**Current Backend Architecture:**

The quote generation flow is implemented as a synchronous HTTP request chain:

```go
// handlers/quote_handler.go
func (h *QuoteHandler) GenerateQuote(c *gin.Context) {
    // Blocking synchronous execution - can take 60+ seconds
    quote, err := h.agents.RunQuoteGenerationPipeline(ctx, leadID)
    if err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    c.JSON(200, quote)
}
```

**AI Agent Pipeline** (`internal/agents/`):

1. **GatekeeperAgent** (`gatekeeper.go`): Lead qualification check (5-10s)
2. **EstimatorAgent** (`estimator.go`): Product detection, pricing calculation (10-20s)
3. **DispatcherAgent** (`dispatcher.go`): Installer matching via semantic search (5-15s)
4. **QuoteGeneratorAgent** (`quote_generator.go`): Document assembly with LLM formatting (10-20s)

Each agent makes 2-4 OpenAI API calls (GPT-4) and performs database queries. Total pipeline time: 30-65 seconds typical, 90+ seconds worst case.

**Existing Infrastructure Assets:**

- **SSE (Server-Sent Events)**: `internal/sse/service.go` provides real-time push with auto-reconnect, JWT authentication, event-type routing
- **Asynq Job Queue**: Used for background email sending and geocoding tasks (`platform/queue/`)
- **Notification System**: In-app notification outbox with SSE delivery (ADR-0001, dated 2026-02-15)
- **Photo Analysis Async Pattern**: Photo upload endpoints already use job-based processing with SSE progress events (`internal/photos/handler.go`)
- **Signal-Based Frontend State**: Angular signals used throughout for reactive state management

**Design Forces:**

- Need to convert long-running AI operations from synchronous to asynchronous
- Must provide granular progress feedback (4-6 steps per pipeline)
- Should enable "fire and forget" UX—users can navigate away during processing
- Must leverage existing notification system for completion alerts
- Should reuse proven SSE infrastructure rather than introducing new patterns
- Need database persistence for job state to survive server restarts
- Must handle failure gracefully with clear error messages and retry options
- Should be extensible to future AI operations (photo analysis, document generation)

## Decision

We will implement a **job-based AI progress tracking system** with the following layered architecture:

### 1. Database Layer: AI Jobs Table

**Schema** (`migrations/NNNN_create_ai_jobs_table.up.sql`):

```sql
CREATE TYPE ai_job_type AS ENUM (
    'quote_generation',
    'gatekeeper_analysis',
    'estimator_run',
    'dispatcher_run',
    'photo_analysis'
);

CREATE TYPE ai_job_status AS ENUM (
    'pending',
    'running',
    'completed',
    'failed',
    'cancelled'
);

CREATE TABLE ai_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type ai_job_type NOT NULL,
    status ai_job_status NOT NULL DEFAULT 'pending',
    
    -- Progress tracking
    current_step INT NOT NULL DEFAULT 0,
    total_steps INT NOT NULL,
    step_name TEXT,
    progress_pct INT CHECK (progress_pct >= 0 AND progress_pct <= 100),
    
    -- Metadata
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    resource_type TEXT,  -- 'lead', 'quote', 'photo_upload'
    resource_id UUID,
    
    -- Error handling
    error_message TEXT,
    error_details JSONB,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_ai_jobs_user_status (user_id, status),
    INDEX idx_ai_jobs_resource (resource_type, resource_id),
    INDEX idx_ai_jobs_created_at (created_at DESC)
);

-- Cleanup policy: Delete completed jobs after 30 days, failed after 90 days
```

**Key Characteristics:**
- **POS-001**: Separate job record per pipeline execution enables independent tracking and historical audit trail
- **POS-002**: Percentage-based progress (`progress_pct`) provides universal UI rendering pattern across all job types
- **POS-003**: `step_name` text field allows human-readable progress messages without frontend string mapping
- **NEG-001**: Additional table introduces storage overhead—requires cleanup policy to prevent unbounded growth

### 2. Service Layer: AI Job Service

**Interface** (`internal/ai_jobs/service.go`):

```go
type Service interface {
    // Job lifecycle
    CreateJob(ctx context.Context, params CreateJobParams) (*AIJob, error)
    GetJob(ctx context.Context, jobID uuid.UUID) (*AIJob, error)
    ListUserJobs(ctx context.Context, userID uuid.UUID, limit int) ([]*AIJob, error)
    
    // Progress updates
    UpdateProgress(ctx context.Context, jobID uuid.UUID, step int, stepName string) error
    UpdateStatus(ctx context.Context, jobID uuid.UUID, status JobStatus, errorMsg *string) error
    
    // SSE integration
    SetSSE(sse SSEService)
    EmitProgressEvent(ctx context.Context, job *AIJob) error
    
    // Cleanup
    DeleteOldJobs(ctx context.Context, completedDays int, failedDays int) (int64, error)
}

type CreateJobParams struct {
    JobType      JobType
    UserID       uuid.UUID
    TotalSteps   int
    ResourceType *string
    ResourceID   *uuid.UUID
}

type AIJob struct {
    ID           uuid.UUID
    JobType      JobType
    Status       JobStatus
    CurrentStep  int
    TotalSteps   int
    StepName     *string
    ProgressPct  int
    UserID       uuid.UUID
    ResourceType *string
    ResourceID   *uuid.UUID
    ErrorMessage *string
    ErrorDetails map[string]interface{}
    CreatedAt    time.Time
    StartedAt    *time.Time
    CompletedAt  *time.Time
    UpdatedAt    time.Time
}
```

**Implementation Pattern**:

```go
func (s *service) UpdateProgress(ctx context.Context, jobID uuid.UUID, step int, stepName string) error {
    job, err := s.store.UpdateProgress(ctx, jobID, step, stepName)
    if err != nil {
        return err
    }
    
    // Calculate percentage
    job.ProgressPct = int((float64(step) / float64(job.TotalSteps)) * 100)
    
    // Emit SSE event to user
    if err := s.EmitProgressEvent(ctx, job); err != nil {
        log.Error().Err(err).Msg("Failed to emit progress event")
        // Non-fatal - progress saved to DB
    }
    
    return nil
}

func (s *service) EmitProgressEvent(ctx context.Context, job *AIJob) error {
    return s.sse.SendToUser(ctx, job.UserID, SSEEvent{
        Type: "ai_job_progress",
        Data: map[string]interface{}{
            "job": job,
        },
    })
}
```

**Key Characteristics:**
- **POS-004**: DB-first persistence with SSE as secondary notification ensures progress never lost even if SSE connection drops
- **POS-005**: Non-fatal SSE emission failure prevents database update rollback—progress tracking remains reliable
- **NEG-002**: Dual write pattern (DB + SSE) introduces eventual consistency risk if SSE buffer full or user offline

### 3. HTTP Layer: Job Management Endpoints

**Routes** (`internal/ai_jobs/handler/http_handler.go`):

```go
// GET /api/v1/ai-jobs - List current user's jobs (last 20)
func (h *Handler) ListJobs(c *gin.Context) {
    userID := c.GetString("user_id")
    jobs, err := h.service.ListUserJobs(c, uuid.MustParse(userID), 20)
    // ... return jobs
}

// GET /api/v1/ai-jobs/:id - Get specific job details
func (h *Handler) GetJob(c *gin.Context) {
    jobID := c.Param("id")
    job, err := h.service.GetJob(c, uuid.MustParse(jobID))
    // ... return job
}

// POST /api/v1/ai-jobs/:id/cancel - Cancel running job
func (h *Handler) CancelJob(c *gin.Context) {
    jobID := c.Param("id")
    err := h.service.UpdateStatus(c, uuid.MustParse(jobID), JobStatusCancelled, nil)
    // ... handle response
}
```

**Key Characteristics:**
- **POS-006**: RESTful job management enables polling fallback if SSE unavailable
- **POS-007**: Cancel endpoint provides user control over runaway operations
- **NEG-003**: Cancellation requires agent code to check job status periodically—not instant termination

### 4. Agent Instrumentation: Progress Reporting

**Refactored Quote Pipeline** (`internal/agents/quote_pipeline.go`):

```go
type QuotePipeline struct {
    gatekeeper  *GatekeeperAgent
    estimator   *EstimatorAgent
    dispatcher  *DispatcherAgent
    generator   *QuoteGeneratorAgent
    jobService  *ai_jobs.Service
}

func (p *QuotePipeline) RunAsync(ctx context.Context, leadID uuid.UUID, userID uuid.UUID) (uuid.UUID, error) {
    // Create job
    job, err := p.jobService.CreateJob(ctx, ai_jobs.CreateJobParams{
        JobType:      ai_jobs.JobTypeQuoteGeneration,
        UserID:       userID,
        TotalSteps:   4,
        ResourceType: stringPtr("lead"),
        ResourceID:   &leadID,
    })
    if err != nil {
        return uuid.Nil, err
    }
    
    // Queue async execution
    go func() {
        ctx := context.Background() // Detached context
        if err := p.execute(ctx, job.ID, leadID); err != nil {
            p.jobService.UpdateStatus(ctx, job.ID, ai_jobs.JobStatusFailed, stringPtr(err.Error()))
            return
        }
        p.jobService.UpdateStatus(ctx, job.ID, ai_jobs.JobStatusCompleted, nil)
    }()
    
    return job.ID, nil
}

func (p *QuotePipeline) execute(ctx context.Context, jobID uuid.UUID, leadID uuid.UUID) error {
    // Step 1: Gatekeeper
    p.jobService.UpdateProgress(ctx, jobID, 1, "Lead kwalificatie controleren...")
    gatekeeperResult, err := p.gatekeeper.Analyze(ctx, leadID)
    if err != nil { return err }
    
    // Step 2: Estimator
    p.jobService.UpdateProgress(ctx, jobID, 2, "Producten detecteren en prijzen berekenen...")
    estimateResult, err := p.estimator.Run(ctx, leadID, gatekeeperResult)
    if err != nil { return err }
    
    // Step 3: Dispatcher
    p.jobService.UpdateProgress(ctx, jobID, 3, "Installateur zoeken...")
    installer, err := p.dispatcher.Match(ctx, leadID, estimateResult)
    if err != nil { return err }
    
    // Step 4: Quote Generator
    p.jobService.UpdateProgress(ctx, jobID, 4, "Offerte document genereren...")
    quote, err := p.generator.Generate(ctx, leadID, estimateResult, installer)
    if err != nil { return err }
    
    return nil
}
```

**Converted HTTP Handler** (`internal/quotes/handler.go`):

```go
// POST /api/v1/leads/:id/quotes - Start quote generation (returns job ID)
func (h *QuoteHandler) GenerateQuote(c *gin.Context) {
    leadID := c.Param("id")
    userID := c.GetString("user_id")
    
    jobID, err := h.quotePipeline.RunAsync(c, uuid.MustParse(leadID), uuid.MustParse(userID))
    if err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(202, gin.H{
        "job_id": jobID,
        "message": "Quote generation started",
    })
}
```

**Key Characteristics:**
- **POS-008**: HTTP 202 Accepted response signals async pattern to clients immediately
- **POS-009**: Goroutine-based execution with detached context prevents request timeout cancellation
- **POS-010**: Each agent step emits progress before executing—users see "what's happening now" not "what just finished"
- **NEG-004**: Goroutine-based execution complicates error handling and graceful shutdown—requires careful context management
- **NEG-005**: Lost progress updates if server crashes mid-execution—job stuck in "running" state requires background reconciliation

### 5. Frontend Service Layer: AI Job Service

**Service** (`src/app/core/services/ai-job.service.ts`):

```typescript
export type AIJobType = 'quote_generation' | 'gatekeeper_analysis' | 'estimator_run' | 'dispatcher_run' | 'photo_analysis';
export type AIJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface AIJob {
  id: string;
  jobType: AIJobType;
  status: AIJobStatus;
  currentStep: number;
  totalSteps: number;
  stepName: string | null;
  progressPct: number;
  userId: string;
  resourceType: string | null;
  resourceId: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

@Injectable({ providedIn: 'root' })
export class AIJobService {
  private readonly http = inject(HttpClient);
  private readonly sse = inject(SSEService);
  private readonly baseUrl = `${environment.apiBaseUrl}/ai-jobs`;
  
  // Active jobs map (jobID -> job)
  private readonly jobsMap = signal<Map<string, AIJob>>(new Map());
  
  // Computed signals
  readonly activeJobs = computed(() => 
    Array.from(this.jobsMap().values())
      .filter(j => j.status === 'running' || j.status === 'pending')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  );
  
  readonly activeJobCount = computed(() => this.activeJobs().length);
  
  constructor() {
    // Subscribe to SSE progress events
    this.sse.aiJobProgress
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(event => {
        const job = event.data?.['job'] as AIJob | undefined;
        if (job) {
          this.updateJobInMap(job);
        }
      });
  }
  
  // Start tracking a job (call after creating job via API)
  trackJob(job: AIJob): void {
    this.jobsMap.update(map => new Map(map).set(job.id, job));
  }
  
  // Get specific job
  getJob(jobId: string): Observable<AIJob> {
    return this.http.get<AIJob>(`${this.baseUrl}/${jobId}`);
  }
  
  // List user's jobs
  listJobs(): Observable<AIJob[]> {
    return this.http.get<AIJob[]>(this.baseUrl);
  }
  
  // Cancel job
  cancelJob(jobId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${jobId}/cancel`, {}).pipe(
      tap(() => this.removeJobFromMap(jobId))
    );
  }
  
  // Computed signal for specific job
  job(jobId: string): Signal<AIJob | undefined> {
    return computed(() => this.jobsMap().get(jobId));
  }
  
  private updateJobInMap(job: AIJob): void {
    this.jobsMap.update(map => {
      const newMap = new Map(map);
      newMap.set(job.id, job);
      
      // Remove from active tracking if completed/failed
      if (job.status === 'completed' || job.status === 'failed') {
        setTimeout(() => this.removeJobFromMap(job.id), 5000); // Keep visible for 5s
      }
      
      return newMap;
    });
  }
  
  private removeJobFromMap(jobId: string): void {
    this.jobsMap.update(map => {
      const newMap = new Map(map);
      newMap.delete(jobId);
      return newMap;
    });
  }
}
```

**SSE Integration** (extend `src/app/core/services/sse.service.ts`):

```typescript
export type SSEEventType =
  | 'ai_job_progress'  // NEW
  | 'in_app_notification'
  | 'analysis_complete'
  | 'photo_analysis_complete';

private readonly aiJobProgress$ = new Subject<SSEEvent>();
readonly aiJobProgress = this.aiJobProgress$.asObservable();

// In event listener setup
this.eventSource.addEventListener('ai_job_progress', (event) => {
  this.zone.run(() => {
    this.handleEventMessage(event, 'ai_job_progress');
  });
});
```

**Key Characteristics:**
- **POS-011**: Map-based state with computed signals enables granular reactivity—only components tracking specific jobs rerender
- **POS-012**: Auto-removal of completed jobs prevents memory leak in long-running single-page sessions
- **POS-013**: Signal-based API allows components to subscribe to specific job IDs without manual subscription management
- **NEG-006**: Map state lost on page refresh—requires rehydration via `listJobs()` on app initialization
- **NEG-007**: 5-second removal delay is arbitrary—may feel too fast or too slow depending on user reading speed

### 6. UI Components Layer

#### 6.1 AI Job Progress Card (`src/app/shared/components/ai-job-progress-card/`)

Inline progress card for embedding in specific pages (e.g., lead detail during quote generation):

```typescript
@Component({
  selector: 'app-ai-job-progress-card',
  standalone: true,
  template: `
    <div class="progress-card" [attr.data-status]="job()?.status">
      @if (job(); as j) {
        <!-- Header -->
        <div class="header">
          <div class="title-row">
            <icon [name]="getJobIcon(j.jobType)" />
            <h4>{{ getJobTitle(j.jobType) }}</h4>
          </div>
          @if (j.status === 'running') {
            <button (click)="cancel()" class="text-sm text-gray-500">Annuleren</button>
          }
        </div>
        
        <!-- Progress Bar -->
        @if (j.status === 'pending' || j.status === 'running') {
          <div class="progress-bar-container">
            <div class="progress-bar" [style.width.%]="j.progressPct"></div>
          </div>
          <p class="step-name">{{ j.stepName || 'Wachten op verwerking...' }}</p>
          <p class="step-counter">Stap {{ j.currentStep }} van {{ j.totalSteps }}</p>
        }
        
        <!-- Completed State -->
        @if (j.status === 'completed') {
          <div class="success-state">
            <icon name="check-circle" class="text-green-600" />
            <p>Succesvol voltooid</p>
          </div>
        }
        
        <!-- Failed State -->
        @if (j.status === 'failed') {
          <div class="error-state">
            <icon name="x-circle" class="text-red-600" />
            <p class="error-msg">{{ j.errorMessage || 'Er is een fout opgetreden' }}</p>
            <button (click)="retry()">Opnieuw proberen</button>
          </div>
        }
      }
    </div>
  `
})
export class AIJobProgressCardComponent {
  private readonly aiJobService = inject(AIJobService);
  
  @Input({ required: true }) jobId!: string;
  @Output() completed = new EventEmitter<void>();
  @Output() failed = new EventEmitter<string>();
  
  readonly job = computed(() => this.aiJobService.job(this.jobId)());
  
  ngOnInit() {
    // Watch for completion
    effect(() => {
      const j = this.job();
      if (j?.status === 'completed') {
        this.completed.emit();
      } else if (j?.status === 'failed') {
        this.failed.emit(j.errorMessage || 'Unknown error');
      }
    });
  }
  
  cancel() {
    this.aiJobService.cancelJob(this.jobId).subscribe();
  }
  
  retry() {
    // Emit event for parent to handle retry logic
    this.failed.emit('retry_requested');
  }
  
  getJobTitle(type: AIJobType): string {
    const titles: Record<AIJobType, string> = {
      quote_generation: 'Offerte genereren',
      gatekeeper_analysis: 'Lead analyseren',
      estimator_run: 'Prijzen berekenen',
      dispatcher_run: 'Installateur zoeken',
      photo_analysis: 'Foto\'s analyseren',
    };
    return titles[type];
  }
  
  getJobIcon(type: AIJobType): string {
    const icons: Record<AIJobType, string> = {
      quote_generation: 'document-text',
      gatekeeper_analysis: 'shield-check',
      estimator_run: 'calculator',
      dispatcher_run: 'users',
      photo_analysis: 'camera',
    };
    return icons[type];
  }
}
```

**Usage in Quote Creation Flow** (`src/app/routes/leads/lead-detail/lead-detail.component.ts`):

```typescript
export class LeadDetailComponent {
  private readonly quoteService = inject(QuoteService);
  private readonly aiJobService = inject(AIJobService);
  
  readonly currentQuoteJobId = signal<string | null>(null);
  
  async generateQuote() {
    const response = await firstValueFrom(
      this.quoteService.generate(this.lead().id)
    ); // Returns { job_id: string }
    
    // Track job in AIJobService
    const job = await firstValueFrom(this.aiJobService.getJob(response.job_id));
    this.aiJobService.trackJob(job);
    this.currentQuoteJobId.set(response.job_id);
  }
  
  onQuoteCompleted() {
    this.currentQuoteJobId.set(null);
    // Refresh lead to show new quote
    this.refreshLead();
  }
  
  onQuoteFailed(error: string) {
    if (error === 'retry_requested') {
      this.generateQuote(); // Retry
    } else {
      // Show error toast
    }
  }
}
```

**Template**:

```html
<!-- Show progress card if quote job active -->
@if (currentQuoteJobId(); as jobId) {
  <app-ai-job-progress-card
    [jobId]="jobId"
    (completed)="onQuoteCompleted()"
    (failed)="onQuoteFailed($event)"
  />
}
```

**Key Characteristics:**
- **POS-014**: Component-level job tracking enables page-specific progress feedback without global state pollution
- **POS-015**: Completion/failure events allow parent components to react (refresh data, show toasts, retry)
- **POS-016**: Visual iconography differentiates job types at a glance
- **NEG-008**: Inline placement assumes job card doesn't need to persist across navigation—requires jobs panel for multi-page tracking

#### 6.2 AI Jobs Panel (`src/app/shared/components/ai-jobs-panel/`)

Global jobs panel in top navigation (similar to notification bell):

```typescript
@Component({
  selector: 'app-ai-jobs-panel',
  standalone: true,
  template: `
    <button (click)="togglePanel()" class="relative">
      <icon name="cog" [class.animate-spin]="activeJobCount() > 0" />
      @if (activeJobCount() > 0) {
        <span class="badge">{{ activeJobCount() }}</span>
      }
    </button>
    
    @if (isPanelOpen()) {
      <div class="dropdown-panel">
        <h3>Actieve Verwerking</h3>
        
        @if (activeJobs().length === 0) {
          <empty-state message="Geen actieve taken" />
        } @else {
          <ul>
            @for (job of activeJobs(); track job.id) {
              <li>
                <app-ai-job-progress-card [jobId]="job.id" />
              </li>
            }
          </ul>
        }
      </div>
    }
  `
})
export class AIJobsPanelComponent {
  private readonly aiJobService = inject(AIJobService);
  
  readonly activeJobs = this.aiJobService.activeJobs;
  readonly activeJobCount = this.aiJobService.activeJobCount;
  readonly isPanelOpen = signal(false);
  
  togglePanel() {
    this.isPanelOpen.update(v => !v);
  }
}
```

**Integration in App Shell** (`src/app/app.html`):

```html
<nav>
  <app-notification-bell />
  <app-ai-jobs-panel />  <!-- NEW -->
  <app-user-menu />
</nav>
```

**Key Characteristics:**
- **POS-017**: Global visibility allows users to check progress from anywhere in app
- **POS-018**: Spinning cog icon provides ambient awareness of background activity
- **POS-019**: Reuses progress card component for consistent UX
- **NEG-009**: Limited panel space may truncate long job lists—no pagination/scrolling design yet

### 7. Notification Integration

**Backend: Emit Notification on Job Completion** (`internal/ai_jobs/service.go`):

```go
func (s *service) UpdateStatus(ctx context.Context, jobID uuid.UUID, status JobStatus, errorMsg *string) error {
    job, err := s.store.UpdateStatus(ctx, jobID, status, errorMsg)
    if err != nil {
        return err
    }
    
    // Create notification for completed/failed jobs
    if status == JobStatusCompleted || status == JobStatusFailed {
        if err := s.createCompletionNotification(ctx, job); err != nil {
            log.Error().Err(err).Msg("Failed to create job completion notification")
            // Non-fatal
        }
    }
    
    return nil
}

func (s *service) createCompletionNotification(ctx context.Context, job *AIJob) error {
    var title, content string
    var category notification.Category
    
    if job.Status == JobStatusCompleted {
        title = s.getCompletedTitle(job.JobType)
        content = s.getCompletedContent(job.JobType)
        category = notification.CategorySuccess
    } else {
        title = s.getFailedTitle(job.JobType)
        content = job.ErrorMessage
        category = notification.CategoryError
    }
    
    return s.notificationService.Create(ctx, notification.CreateParams{
        UserID:       job.UserID,
        Title:        title,
        Content:      content,
        Category:     category,
        ResourceType: job.ResourceType,
        ResourceID:   job.ResourceID,
    })
}
```

**Frontend: No Additional Code Required**

Notifications automatically delivered via existing `NotificationsService` (ADR-0001). User sees:

1. **In-App Notification Badge** increments
2. **Notification Panel** shows "Offerte succesvol gegenereerd"
3. **Click notification** → navigates to lead/quote detail page

**Key Characteristics:**
- **POS-020**: Zero-configuration notification delivery leverages outbox pattern (ADR-0001)
- **POS-021**: Completion notifications provide closure even if user closed jobs panel
- **NEG-010**: Notification created even if user still viewing progress card—may feel redundant

### 8. Error Handling Strategy

**Backend Errors**:

1. **LLM API Failure**: Retry with exponential backoff (3 attempts), then fail job with "OpenAI API unavailable" message
2. **Database Error**: Fail job immediately with technical error message
3. **Business Logic Error**: Fail job with user-friendly error (e.g., "Geen installateurs gevonden in regio")
4. **Timeout**: Fail job after 120 seconds total pipeline time

**Frontend Error States**:

1. **SSE Connection Lost**: Fall back to polling `GET /ai-jobs/:id` every 5 seconds for active jobs
2. **Job Fetch Failed**: Show error toast, remove job from tracking
3. **Cancel Failed**: Show error toast, keep job in running state

**Key Characteristics:**
- **POS-022**: Graceful degradation with polling fallback ensures progress visible even during connectivity issues
- **NEG-011**: Polling introduces latency (up to 5s delay) and server load spike during SSE outages

## Consequences

### Positive

- **POS-001**: Separate job record per pipeline execution enables independent tracking and historical audit trail
- **POS-002**: Percentage-based progress (`progress_pct`) provides universal UI rendering pattern across all job types
- **POS-003**: `step_name` text field allows human-readable progress messages without frontend string mapping
- **POS-004**: DB-first persistence with SSE as secondary notification ensures progress never lost even if SSE connection drops
- **POS-005**: Non-fatal SSE emission failure prevents database update rollback—progress tracking remains reliable
- **POS-006**: RESTful job management enables polling fallback if SSE unavailable
- **POS-007**: Cancel endpoint provides user control over runaway operations
- **POS-008**: HTTP 202 Accepted response signals async pattern to clients immediately
- **POS-009**: Goroutine-based execution with detached context prevents request timeout cancellation
- **POS-010**: Each agent step emits progress before executing—users see "what's happening now" not "what just finished"
- **POS-011**: Map-based state with computed signals enables granular reactivity—only components tracking specific jobs rerender
- **POS-012**: Auto-removal of completed jobs prevents memory leak in long-running single-page sessions
- **POS-013**: Signal-based API allows components to subscribe to specific job IDs without manual subscription management
- **POS-014**: Component-level job tracking enables page-specific progress feedback without global state pollution
- **POS-015**: Completion/failure events allow parent components to react (refresh data, show toasts, retry)
- **POS-016**: Visual iconography differentiates job types at a glance
- **POS-017**: Global visibility allows users to check progress from anywhere in app
- **POS-018**: Spinning cog icon provides ambient awareness of background activity
- **POS-019**: Reuses progress card component for consistent UX
- **POS-020**: Zero-configuration notification delivery leverages outbox pattern (ADR-0001)
- **POS-021**: Completion notifications provide closure even if user closed jobs panel
- **POS-022**: Graceful degradation with polling fallback ensures progress visible even during connectivity issues

### Negative

- **NEG-001**: Additional table introduces storage overhead—requires cleanup policy to prevent unbounded growth
- **NEG-002**: Dual write pattern (DB + SSE) introduces eventual consistency risk if SSE buffer full or user offline
- **NEG-003**: Cancellation requires agent code to check job status periodically—not instant termination
- **NEG-004**: Goroutine-based execution complicates error handling and graceful shutdown—requires careful context management
- **NEG-005**: Lost progress updates if server crashes mid-execution—job stuck in "running" state requires background reconciliation
- **NEG-006**: Map state lost on page refresh—requires rehydration via `listJobs()` on app initialization
- **NEG-007**: 5-second removal delay is arbitrary—may feel too fast or too slow depending on user reading speed
- **NEG-008**: Inline placement assumes job card doesn't need to persist across navigation—requires jobs panel for multi-page tracking
- **NEG-009**: Limited panel space may truncate long job lists—no pagination/scrolling design yet
- **NEG-010**: Notification created even if user still viewing progress card—may feel redundant
- **NEG-011**: Polling introduces latency (up to 5s delay) and server load spike during SSE outages

## Alternatives Considered

### Alternative A: Polling-Based Progress Tracking

- **ALT-001**: **Description**: Use `interval(2000)` to poll `GET /ai-jobs/:id` every 2 seconds instead of SSE for progress updates
- **ALT-002**: **Rejection Reason**: High server load (N active jobs × 0.5 req/s = RPS spike), unnecessary bandwidth consumption, increased latency (up to 2s delay per update), and duplicates SSE infrastructure already proven reliable for photo analysis and notifications

### Alternative B: WebSocket Instead of SSE

- **ALT-003**: **Description**: Replace SSE with bidirectional WebSocket connection for progress events
- **ALT-004**: **Rejection Reason**: SSE sufficient for unidirectional progress push (server → client), WebSocket adds complexity (connection management, message framing, ping/pong), and existing SSE infrastructure already handles auto-reconnect and JWT auth; bidirectional channel unnecessary for progress tracking

### Alternative C: Synchronous with Enhanced Loading UI

- **ALT-005**: **Description**: Keep quote generation synchronous but improve loading spinner with animated graphics and "estimated time remaining" messages
- **ALT-006**: **Rejection Reason**: Does not solve core UX problem—users still cannot navigate away without losing work, no multitasking capability, and perceived wait time remains high regardless of visual polish; async pattern fundamentally superior for operations >10 seconds

### Alternative D: Streaming LLM Tokens (ChatGPT-Style)

- **ALT-007**: **Description**: Stream OpenAI response tokens in real-time to show quote text being "typed out" character-by-character
- **ALT-008**: **Rejection Reason**: OpenAI streaming API requires dedicated HTTP connection per LLM call, complicates backend architecture (streaming + job persistence), provides minimal value for batch operations (4 agents run sequentially—token streaming only visible during last step), and may confuse users expecting structured output not raw generation

### Alternative E: Asynq Job Queue Instead of Goroutines

- **ALT-009**: **Description**: Use Asynq distributed task queue for AI job execution instead of in-process goroutines
- **ALT-010**: **Rejection Reason**: Adds Redis dependency, increases latency (queue enqueue/dequeue overhead), complicates deployment (requires Asynq worker processes), and over-engineered for current scale (single-server deployment handles goroutines well); better suited if horizontal scaling across multiple servers required in future

## Implementation Notes

- **IMP-001**: Create `ai_jobs` table migration first—test rollback to ensure clean schema changes
- **IMP-002**: Implement AI job service with unit tests before instrumenting agents—ensures progress tracking logic robust
- **IMP-003**: Refactor quote generation endpoint to async last—allows SSE integration testing with existing photo analysis pattern first
- **IMP-004**: Add `ai_job_progress` SSE event type to SSEService with minimal changes to existing event handling logic
- **IMP-005**: Implement `AIJobProgressCardComponent` before `AIJobsPanelComponent`—inline card needed for immediate user feedback, panel can follow in phase 2
- **IMP-006**: Add database cleanup cron job (Asynq periodic task) to delete old jobs—run daily at 3 AM UTC
- **IMP-007**: Create Cypress E2E test for full quote generation flow: click "Generate" → see progress card → steps increment → completion notification → quote appears
- **IMP-008**: Monitor `ai_jobs` table size during rollout—adjust retention policy if growth exceeds 10k rows/month
- **IMP-009**: Add observability metrics: `ai_job_duration_seconds` (histogram), `ai_job_failures_total` (counter), `ai_job_step_duration_seconds` (histogram per step)
- **IMP-010**: Document agent instrumentation pattern for future AI operations (photo analysis, document generation)—standardize `UpdateProgress()` call placement
- **IMP-011**: Implement graceful shutdown handler to mark running jobs as failed on server restart
- **IMP-012**: Add retry logic for transient LLM API errors (rate limits, timeouts) with exponential backoff before failing job

## References

- **REF-001**: [ADR-0001: In-App Notification Frontend Integration](./adr-0001-in-app-notification-frontend-integration.md) - Notification system architecture
- **REF-002**: Existing SSE infrastructure: [src/app/core/services/sse.service.ts](../../src/app/core/services/sse.service.ts)
- **REF-003**: Photo analysis async pattern (reference implementation): [internal/photos/handler.go](../../../portal_final_backend/internal/photos/handler.go)
- **REF-004**: AI agent implementations: [internal/agents/](../../../portal_final_backend/internal/agents/) directory
- **REF-005**: Asynq job queue setup: [platform/queue/](../../../portal_final_backend/platform/queue/)
- **REF-006**: [OpenAI API Error Handling Best Practices](https://platform.openai.com/docs/guides/error-codes)
- **REF-007**: [Angular Signals Documentation](https://angular.io/guide/signals)
- **REF-008**: [Server-Sent Events Specification](https://html.spec.whatwg.org/multipage/server-sent-events.html)
