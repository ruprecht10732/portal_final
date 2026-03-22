import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { catchError, debounceTime, distinctUntilChanged, finalize, of, switchMap, tap } from 'rxjs';
import { ErrorReportingService } from '../../core/services/error-reporting.service';
import { LeadsService } from '../../core/services/leads.service';
import type { Lead } from '../../core/services/leads.types';
import { SearchService } from '../../core/services/search.service';
import type { SearchResultItem } from '../../core/services/search.types';
import { TasksService } from '../../core/services/tasks.service';
import type { CreateTaskRequest, TaskItem, UpdateTaskRequest } from '../../core/services/tasks.types';
import { ToastService } from '../../core/services/toast.service';
import { UserService } from '../../core/services/user.service';
import type { UserSummary } from '../../core/services/user.types';
import { extractErrorMessage } from '../../core/utils/error-utils';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { CardComponent } from '../../shared/components/card/card.component';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { PageLayoutComponent } from '../../shared/components/page-layout/page-layout.component';

interface UserOption {
  value: string;
  label: string;
}

type TaskStatusFilter = 'open' | 'completed' | 'cancelled';
type TaskScopeFilter = 'all' | 'global' | 'lead_service';

@Component({
  selector: 'app-tasks-page',
  imports: [ReactiveFormsModule, TranslatePipe, DatePipe, ButtonComponent, CardComponent, KpiCardComponent, PageLayoutComponent],
  templateUrl: './tasks-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'app-page-scroll block min-h-full xl:flex xl:flex-col xl:flex-1 xl:min-h-0 xl:overflow-y-auto',
  },
})
export class TasksPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly tasksService = inject(TasksService);
  private readonly userService = inject(UserService);
  private readonly leadsService = inject(LeadsService);
  private readonly searchService = inject(SearchService);
  private readonly reporter = inject(ErrorReportingService);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly tasks = signal<TaskItem[]>([]);
  protected readonly users = signal<UserOption[]>([]);
  protected readonly editingTaskId = signal<string | null>(null);
  protected readonly modalOpen = signal(false);

  // Lead search state
  protected readonly leadQuery = signal('');
  protected readonly leadSearchLoading = signal(false);
  protected readonly leadSearchOpen = signal(false);
  protected readonly leadResults = signal<SearchResultItem[]>([]);
  protected readonly selectedLead = signal<{ id: string; label: string } | null>(null);
  protected readonly leadServices = signal<{ id: string; label: string }[]>([]);
  protected readonly servicesLoading = signal(false);
  protected readonly statusFilter = signal<TaskStatusFilter>('open');
  protected readonly scopeFilter = signal<TaskScopeFilter>('all');
  protected readonly assigneeFilter = signal('');
  private readonly refreshToken = signal(0);

  protected readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    description: [''],
    scopeType: ['global' as 'global' | 'lead_service', Validators.required],
    leadId: [''],
    leadServiceId: [''],
    assignedUserId: ['', Validators.required],
    priority: ['normal' as 'low' | 'normal' | 'high' | 'urgent'],
    dueAt: [''],
    reminderEnabled: [false],
    reminderAt: [''],
    repeatDaily: [false],
    sendEmail: [true],
    sendWhatsApp: [false],
  });

  private readonly filterState = computed(() => ({
    status: this.statusFilter(),
    scope: this.scopeFilter(),
    assignedUserId: this.assigneeFilter().trim(),
    refreshToken: this.refreshToken(),
  }));

  protected readonly openCount = computed(() => this.tasks().filter(task => task.status === 'open').length);
  protected readonly completionCount = computed(() => this.tasks().filter(task => task.status === 'completed').length);
  protected readonly cancellationCount = computed(() => this.tasks().filter(task => task.status === 'cancelled').length);
  protected readonly isEditing = computed(() => this.editingTaskId() !== null);

  constructor() {
    this.loadUsers();
    this.initLeadSearch();

    toObservable(this.filterState)
      .pipe(
        debounceTime(50),
        distinctUntilChanged((left, right) => JSON.stringify(left) === JSON.stringify(right)),
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
        }),
        switchMap((state) => {
          const params: { status: 'open' | 'completed' | 'cancelled'; scope?: 'global' | 'lead_service'; assignedUserId?: string } = {
            status: state.status,
          };
          if (state.scope !== 'all') {
            params.scope = state.scope;
          }
          if (state.assignedUserId) {
            params.assignedUserId = state.assignedUserId;
          }
          return this.tasksService.list(params).pipe(
          catchError((err) => {
            const message = extractErrorMessage(err, this.translate.instant('tasks.messages.loadError'));
            this.error.set(message);
            this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
            return of({ items: [] });
          }),
          finalize(() => this.loading.set(false)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((response) => {
        this.tasks.set(response.items);
      });
  }

  private initLeadSearch(): void {
    toObservable(this.leadQuery)
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        tap(() => this.leadSearchLoading.set(true)),
        switchMap((q) => {
          if (q.trim().length < 2) {
            this.leadSearchLoading.set(false);
            this.leadResults.set([]);
            return of(null);
          }
          return this.searchService.globalSearch({ q: q.trim(), types: 'lead', limit: 8 }).pipe(
            catchError(() => of({ items: [], total: 0 })),
            finalize(() => this.leadSearchLoading.set(false)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((response) => {
        if (response) {
          this.leadResults.set(response.items);
        }
      });
  }

  protected onLeadInput(value: string): void {
    this.leadQuery.set(value);
    this.leadSearchOpen.set(true);
    this.selectedLead.set(null);
    this.form.patchValue({ leadId: '', leadServiceId: '' });
    this.leadServices.set([]);
  }

  protected onLeadBlur(): void {
    setTimeout(() => this.leadSearchOpen.set(false), 150);
  }

  protected selectLead(item: SearchResultItem): void {
    this.selectedLead.set({ id: item.id, label: item.title });
    this.leadQuery.set('');
    this.leadSearchOpen.set(false);
    this.leadResults.set([]);
    this.form.patchValue({ leadId: item.id, leadServiceId: '' });
    this.loadLeadServices(item.id);
  }

  protected clearLead(): void {
    this.selectedLead.set(null);
    this.leadQuery.set('');
    this.leadResults.set([]);
    this.leadServices.set([]);
    this.form.patchValue({ leadId: '', leadServiceId: '' });
  }

  protected selectService(serviceId: string): void {
    this.form.patchValue({ leadServiceId: serviceId });
  }

  private loadLeadServices(leadId: string): void {
    this.servicesLoading.set(true);
    this.leadsService.getById(leadId)
      .pipe(
        finalize(() => this.servicesLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (lead: Lead) => {
          this.leadServices.set(lead.services.map(s => ({
            id: s.id,
            label: `${s.serviceType} — ${s.status}`,
          })));
          if (lead.services.length === 1 && lead.services[0]) {
            this.form.patchValue({ leadServiceId: lead.services[0].id });
          }
        },
        error: () => this.leadServices.set([]),
      });
  }

  private loadLeadForEdit(leadId: string, leadServiceId: string | null): void {
    this.servicesLoading.set(true);
    this.leadsService.getById(leadId)
      .pipe(
        finalize(() => this.servicesLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (lead: Lead) => {
          const name = `${lead.consumer.firstName} ${lead.consumer.lastName}`.trim();
          const address = `${lead.address.street} ${lead.address.houseNumber}, ${lead.address.city}`;
          this.selectedLead.set({ id: lead.id, label: `${name} — ${address}` });
          this.leadServices.set(lead.services.map(s => ({
            id: s.id,
            label: `${s.serviceType} — ${s.status}`,
          })));
          if (leadServiceId) {
            this.form.patchValue({ leadServiceId });
          }
        },
        error: () => this.leadServices.set([]),
      });
  }

  protected setStatusFilter(value: TaskStatusFilter): void {
    this.statusFilter.set(value);
  }

  protected setScopeFilter(value: TaskScopeFilter): void {
    this.scopeFilter.set(value);
  }

  protected setAssigneeFilter(value: string): void {
    this.assigneeFilter.set(value);
  }

  protected startCreate(): void {
    this.editingTaskId.set(null);
    this.resetForm();
    this.modalOpen.set(true);
  }

  protected editTask(task: TaskItem): void {
    this.editingTaskId.set(task.id);
    this.modalOpen.set(true);
    this.selectedLead.set(null);
    this.leadQuery.set('');
    this.leadResults.set([]);
    this.leadServices.set([]);
    this.form.setValue({
      title: task.title,
      description: task.description ?? '',
      scopeType: task.scopeType,
      leadId: task.leadId ?? '',
      leadServiceId: task.leadServiceId ?? '',
      assignedUserId: task.assignedUserId,
      priority: task.priority,
      dueAt: toDateTimeLocalValue(task.dueAt),
      reminderEnabled: task.reminder?.enabled ?? false,
      reminderAt: toDateTimeLocalValue(task.reminder?.nextRunAt ?? null),
      repeatDaily: task.reminder?.repeatDaily ?? false,
      sendEmail: task.reminder?.sendEmail ?? true,
      sendWhatsApp: task.reminder?.sendWhatsApp ?? false,
    });
    if (task.scopeType === 'lead_service' && task.leadId) {
      this.loadLeadForEdit(task.leadId, task.leadServiceId);
    }
  }

  protected resetEditor(): void {
    this.editingTaskId.set(null);
    this.modalOpen.set(false);
    this.resetForm();
    this.selectedLead.set(null);
    this.leadQuery.set('');
    this.leadResults.set([]);
    this.leadServices.set([]);
  }

  protected closeModal(): void {
    this.resetEditor();
  }

  protected statusClass(status: string): string {
    switch (status) {
      case 'open': return 'bg-blue-50 text-blue-700';
      case 'completed': return 'bg-emerald-50 text-emerald-700';
      case 'cancelled': return 'bg-red-50 text-red-500';
      default: return 'bg-zinc-100 text-zinc-500';
    }
  }

  protected priorityClass(priority: string): string {
    switch (priority) {
      case 'low': return 'bg-zinc-100 text-zinc-500';
      case 'normal': return 'bg-sky-50 text-sky-600';
      case 'high': return 'bg-orange-50 text-orange-600';
      case 'urgent': return 'bg-red-50 text-red-600';
      default: return 'bg-zinc-100 text-zinc-500';
    }
  }

  protected saveTask(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload = this.buildPayload();
    if (!payload) {
      return;
    }

    this.saving.set(true);
    const editingTaskId = this.editingTaskId();
    const request$ = editingTaskId
      ? this.tasksService.update(editingTaskId, payload as UpdateTaskRequest)
      : this.tasksService.create(payload as CreateTaskRequest);

    request$
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.toast.success(this.translate.instant(this.editingTaskId() ? 'tasks.messages.updateSuccess' : 'tasks.messages.createSuccess'));
          this.resetEditor();
          this.refreshToken.update((value) => value + 1);
        },
        error: (err) => {
          const message = extractErrorMessage(err, this.translate.instant('tasks.messages.saveError'));
          this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        },
      });
  }

  protected completeTask(task: TaskItem): void {
    this.tasksService.complete(task.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toast.success(this.translate.instant('tasks.messages.completeSuccess'));
          this.refreshToken.update((value) => value + 1);
        },
        error: (err) => {
          this.reporter.report(err, { source: 'http', silent: true, userMessage: this.translate.instant('tasks.messages.saveError') });
        },
      });
  }

  protected cancelTask(task: TaskItem): void {
    this.tasksService.cancel(task.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toast.success(this.translate.instant('tasks.messages.cancelSuccess'));
          this.refreshToken.update((value) => value + 1);
        },
        error: (err) => {
          this.reporter.report(err, { source: 'http', silent: true, userMessage: this.translate.instant('tasks.messages.saveError') });
        },
      });
  }

  protected assigneeLabel(task: TaskItem): string {
    const first = task.assigneeFirstName?.trim() ?? '';
    const last = task.assigneeLastName?.trim() ?? '';
    return `${first} ${last}`.trim() || task.assigneeEmail;
  }

  protected trackTask(_: number, task: TaskItem): string {
    return task.id;
  }

  private loadUsers(): void {
    this.userService.listUsers()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (users) => {
          this.users.set(users.map((user) => ({
            value: user.id,
            label: buildUserLabel(user),
          })));
          if (!this.form.controls.assignedUserId.value && users.length > 0) {
            this.form.patchValue({ assignedUserId: users[0]?.id ?? '' });
          }
        },
        error: (err) => {
          const message = extractErrorMessage(err, this.translate.instant('tasks.messages.loadUsersError'));
          this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        },
      });
  }

  private buildPayload(): CreateTaskRequest | UpdateTaskRequest | null {
    const raw = this.form.getRawValue();
    const dueAt = toIsoString(raw.dueAt);
    const reminderAt = toIsoString(raw.reminderAt);
    const reminder = raw.reminderEnabled && reminderAt
      ? {
          enabled: true,
          runAt: reminderAt,
          repeatDaily: raw.repeatDaily,
          sendEmail: raw.sendEmail,
          sendWhatsApp: raw.sendWhatsApp,
        }
      : undefined;

    if (this.editingTaskId()) {
      const updatePayload: UpdateTaskRequest = {
        title: raw.title.trim(),
        description: raw.description.trim(),
        priority: raw.priority,
        assignedUserId: raw.assignedUserId,
        clearDueAt: !dueAt,
        clearReminder: !reminder,
      };
      if (dueAt) {
        updatePayload.dueAt = dueAt;
      }
      if (reminder) {
        updatePayload.reminder = reminder;
      }
      return updatePayload;
    }

    const createPayload: CreateTaskRequest = {
      scopeType: raw.scopeType,
      assignedUserId: raw.assignedUserId,
      title: raw.title.trim(),
      priority: raw.priority,
    };
    const description = raw.description.trim();
    if (description) {
      createPayload.description = description;
    }
    if (raw.scopeType === 'lead_service') {
      const leadId = raw.leadId.trim();
      const leadServiceId = raw.leadServiceId.trim();
      if (leadId) {
        createPayload.leadId = leadId;
      }
      if (leadServiceId) {
        createPayload.leadServiceId = leadServiceId;
      }
    }
    if (dueAt) {
      createPayload.dueAt = dueAt;
    }
    if (reminder) {
      createPayload.reminder = reminder;
    }
    return createPayload;
  }

  private resetForm(): void {
    this.form.reset({
      title: '',
      description: '',
      scopeType: 'global',
      leadId: '',
      leadServiceId: '',
      assignedUserId: this.users()[0]?.value ?? '',
      priority: 'normal',
      dueAt: '',
      reminderEnabled: false,
      reminderAt: '',
      repeatDaily: false,
      sendEmail: true,
      sendWhatsApp: false,
    });
  }
}

function buildUserLabel(user: UserSummary): string {
  const fullName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
  return fullName ? `${fullName} · ${user.email}` : user.email;
}

function toIsoString(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return new Date(trimmed).toISOString();
}

function toDateTimeLocalValue(value: string | null): string {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  const offsetMinutes = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offsetMinutes * 60_000);
  return local.toISOString().slice(0, 16);
}