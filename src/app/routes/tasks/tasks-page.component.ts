import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { catchError, debounceTime, distinctUntilChanged, finalize, of, switchMap, tap } from 'rxjs';
import { ErrorReportingService } from '../../core/services/error-reporting.service';
import { TasksService } from '../../core/services/tasks.service';
import type { CreateTaskRequest, TaskItem, UpdateTaskRequest } from '../../core/services/tasks.types';
import { ToastService } from '../../core/services/toast.service';
import { UserService } from '../../core/services/user.service';
import type { UserSummary } from '../../core/services/user.types';
import { extractErrorMessage } from '../../core/utils/error-utils';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { PageLayoutComponent } from '../../shared/components/page-layout/page-layout.component';

interface UserOption {
  value: string;
  label: string;
}

type TaskStatusFilter = 'open' | 'completed' | 'cancelled';
type TaskScopeFilter = 'all' | 'global' | 'lead_service';

@Component({
  selector: 'app-tasks-page',
  imports: [ReactiveFormsModule, TranslatePipe, DatePipe, ButtonComponent, PageLayoutComponent],
  templateUrl: './tasks-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block min-h-full',
  },
})
export class TasksPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly tasksService = inject(TasksService);
  private readonly userService = inject(UserService);
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
  }

  protected editTask(task: TaskItem): void {
    this.editingTaskId.set(task.id);
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
  }

  protected resetEditor(): void {
    this.editingTaskId.set(null);
    this.resetForm();
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