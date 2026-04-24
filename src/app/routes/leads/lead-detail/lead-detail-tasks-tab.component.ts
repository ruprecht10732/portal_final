import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { catchError, distinctUntilChanged, finalize, of, switchMap, tap } from 'rxjs';
import { ErrorReportingService } from '../../../core/services/error-reporting.service';
import { TasksService } from '../../../core/services/tasks.service';
import type { CreateTaskRequest, TaskItem, UpdateTaskRequest } from '../../../core/services/tasks.types';
import { ToastService } from '../../../core/services/toast.service';
import { UserService } from '../../../core/services/user.service';
import type { UserSummary } from '../../../core/services/user.types';
import { extractErrorMessage } from '../../../core/utils/error-utils';
import { formatFullName } from '../../../core/utils/format-utils';
import { ButtonComponent } from '../../../shared/components/button/button.component';

type StatusFilter = 'open' | 'completed' | 'cancelled';

@Component({
  selector: 'app-lead-detail-tasks-tab',
  templateUrl: './lead-detail-tasks-tab.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslatePipe, DatePipe, ButtonComponent],
})
export class LeadDetailTasksTabComponent {
  readonly leadId = input.required<string>();
  readonly leadServiceId = input<string | null>(null);

  private readonly tasksService = inject(TasksService);
  private readonly userService = inject(UserService);
  private readonly fb = inject(FormBuilder);
  private readonly translate = inject(TranslateService);
  private readonly toast = inject(ToastService);
  private readonly reporter = inject(ErrorReportingService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly tasks = signal<TaskItem[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly modalOpen = signal(false);
  protected readonly editingTaskId = signal<string | null>(null);
  protected readonly statusFilter = signal<StatusFilter>('open');
  protected readonly users = signal<{ value: string; label: string }[]>([]);
  private readonly refreshToken = signal(0);

  protected readonly isEditing = computed(() => this.editingTaskId() !== null);

  protected readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    description: [''],
    assignedUserId: ['', Validators.required],
    priority: ['normal' as 'low' | 'normal' | 'high' | 'urgent'],
    dueAt: [''],
    reminderEnabled: [false],
    reminderAt: [''],
    repeatDaily: [false],
    sendEmail: [true],
    sendWhatsApp: [false],
  });

  private readonly loadParams = computed(() => ({
    leadId: this.leadId(),
    status: this.statusFilter(),
    refresh: this.refreshToken(),
  }));

  constructor() {
    this.loadUsers();

    toObservable(this.loadParams)
      .pipe(
        distinctUntilChanged((a, b) =>
          a.leadId === b.leadId && a.status === b.status && a.refresh === b.refresh,
        ),
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
        }),
        switchMap((params) =>
          this.tasksService
            .list({
              leadId: params.leadId,
              scope: 'lead_service',
              status: params.status,
            })
            .pipe(
              catchError((err) => {
                const msg = extractErrorMessage(err, this.translate.instant('tasks.messages.loadError'));
                this.error.set(msg);
                this.reporter.report(err, { source: 'http', silent: true, userMessage: msg });
                return of({ items: [] });
              }),
              finalize(() => this.loading.set(false)),
            ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res) => this.tasks.set(res.items));
  }

  protected setStatusFilter(value: StatusFilter): void {
    this.statusFilter.set(value);
  }

  protected startCreate(): void {
    this.editingTaskId.set(null);
    this.resetForm();
    this.modalOpen.set(true);
  }

  protected editTask(task: TaskItem): void {
    this.editingTaskId.set(task.id);
    this.form.setValue({
      title: task.title,
      description: task.description ?? '',
      assignedUserId: task.assignedUserId,
      priority: task.priority,
      dueAt: toDateTimeLocalValue(task.dueAt),
      reminderEnabled: task.reminder?.enabled ?? false,
      reminderAt: toDateTimeLocalValue(task.reminder?.nextRunAt ?? null),
      repeatDaily: task.reminder?.repeatDaily ?? false,
      sendEmail: task.reminder?.sendEmail ?? true,
      sendWhatsApp: task.reminder?.sendWhatsApp ?? false,
    });
    this.modalOpen.set(true);
  }

  protected closeModal(): void {
    this.editingTaskId.set(null);
    this.modalOpen.set(false);
    this.resetForm();
  }

  protected saveTask(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const editingId = this.editingTaskId();
    const payload = editingId ? this.buildUpdatePayload() : this.buildCreatePayload();
    if (!payload) return;

    this.saving.set(true);
    const request$ = editingId
      ? this.tasksService.update(editingId, payload as UpdateTaskRequest)
      : this.tasksService.create(payload as CreateTaskRequest);

    request$
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.toast.success(
            this.translate.instant(
              editingId ? 'tasks.messages.updateSuccess' : 'tasks.messages.createSuccess',
            ),
          );
          this.closeModal();
          this.refreshToken.update((v) => v + 1);
        },
        error: (err) => {
          const msg = extractErrorMessage(err, this.translate.instant('tasks.messages.saveError'));
          this.reporter.report(err, { source: 'http', silent: true, userMessage: msg });
        },
      });
  }

  private buildUpdatePayload(): UpdateTaskRequest {
    const raw = this.form.getRawValue();
    const dueAt = toIsoString(raw.dueAt);
    const reminder = this.buildReminder(raw);
    const payload: UpdateTaskRequest = {
      title: raw.title.trim(),
      description: raw.description.trim(),
      priority: raw.priority,
      assignedUserId: raw.assignedUserId,
      clearDueAt: !dueAt,
      clearReminder: !reminder,
    };
    if (dueAt) payload.dueAt = dueAt;
    if (reminder) payload.reminder = reminder;
    return payload;
  }

  private buildCreatePayload(): CreateTaskRequest {
    const raw = this.form.getRawValue();
    const dueAt = toIsoString(raw.dueAt);
    const reminder = this.buildReminder(raw);
    const payload: CreateTaskRequest = {
      scopeType: 'lead_service',
      leadId: this.leadId(),
      assignedUserId: raw.assignedUserId,
      title: raw.title.trim(),
      priority: raw.priority,
    };
    const svcId = this.leadServiceId();
    if (svcId) payload.leadServiceId = svcId;
    const desc = raw.description.trim();
    if (desc) payload.description = desc;
    if (dueAt) payload.dueAt = dueAt;
    if (reminder) payload.reminder = reminder;
    return payload;
  }

  private buildReminder(raw: ReturnType<typeof this.form.getRawValue>) {
    const reminderAt = toIsoString(raw.reminderAt);
    if (!raw.reminderEnabled || !reminderAt) return undefined;
    return {
      enabled: true,
      runAt: reminderAt,
      repeatDaily: raw.repeatDaily,
      sendEmail: raw.sendEmail,
      sendWhatsApp: raw.sendWhatsApp,
    };
  }

  protected completeTask(task: TaskItem): void {
    this.tasksService
      .complete(task.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toast.success(this.translate.instant('tasks.messages.completeSuccess'));
          this.refreshToken.update((v) => v + 1);
        },
        error: (err) =>
          this.reporter.report(err, { source: 'http', silent: true }),
      });
  }

  protected cancelTask(task: TaskItem): void {
    this.tasksService
      .cancel(task.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toast.success(this.translate.instant('tasks.messages.cancelSuccess'));
          this.refreshToken.update((v) => v + 1);
        },
        error: (err) =>
          this.reporter.report(err, { source: 'http', silent: true }),
      });
  }

  protected assigneeLabel(task: TaskItem): string {
    const name = formatFullName(task.assigneeFirstName, task.assigneeLastName);
    return name === '—' ? task.assigneeEmail : name;
  }

  protected trackTask(_: number, task: TaskItem): string {
    return task.id;
  }

  private readonly statusClassMap: Record<string, string> = {
    open: 'bg-blue-50 text-blue-700',
    completed: 'bg-emerald-50 text-emerald-700',
    cancelled: 'bg-red-50 text-red-500',
  };

  protected statusClass(status: string): string {
    return this.statusClassMap[status] ?? 'bg-zinc-100 text-zinc-500';
  }

  private readonly priorityClassMap: Record<string, string> = {
    low: 'bg-zinc-100 text-zinc-500',
    normal: 'bg-sky-50 text-sky-600',
    high: 'bg-orange-50 text-orange-600',
    urgent: 'bg-red-50 text-red-600',
  };

  protected priorityClass(priority: string): string {
    return this.priorityClassMap[priority] ?? 'bg-zinc-100 text-zinc-500';
  }

  private loadUsers(): void {
    this.userService
      .listUsers()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (users) => {
          this.users.set(
            users.map((u) => ({ value: u.id, label: buildUserLabel(u) })),
          );
          if (!this.form.controls.assignedUserId.value && users.length > 0) {
            this.form.patchValue({ assignedUserId: users[0]?.id ?? '' });
          }
        },
        error: (err) =>
          this.reporter.report(err, {
            source: 'http',
            silent: true,
            userMessage: this.translate.instant('tasks.messages.loadUsersError'),
          }),
      });
  }

  private resetForm(): void {
    this.form.reset({
      title: '',
      description: '',
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
  const fullName = formatFullName(user.firstName, user.lastName);
  return fullName === '—' ? user.email : `${fullName} · ${user.email}`;
}

function toIsoString(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return new Date(trimmed).toISOString();
}

function toDateTimeLocalValue(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
