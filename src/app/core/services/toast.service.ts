import { Injectable, signal } from '@angular/core';
import { TOAST_DURATION_MS } from '../config';

export type ToastVariant = 'info' | 'success' | 'warning' | 'error';

export interface ToastLink {
  label: string;
  url: string | string[];
  external?: boolean;
}

export interface ToastItem {
  id: string;
  message: string;
  title?: string | undefined;
  variant: ToastVariant;
  dismissible: boolean;
  durationMs: number | null;
  createdAt: number;
  link?: ToastLink | undefined;
}

export interface ToastOptions {
  message: string;
  title?: string | undefined;
  variant?: ToastVariant | undefined;
  dismissible?: boolean | undefined;
  durationMs?: number | null | undefined;
  link?: ToastLink | undefined;
}

const DEFAULT_DURATIONS: Record<ToastVariant, number> = TOAST_DURATION_MS;

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly items = signal<ToastItem[]>([]);
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  /** Expose state as readonly to prevent external mutation */
  readonly toasts = this.items.asReadonly();

  /**
   * Shows a toast notification.
   * Includes a basic deduplication check to prevent spamming identical messages.
   */
  show(options: ToastOptions): string {
    const { 
      message, 
      title, 
      variant = 'info', 
      dismissible = true, 
      durationMs = DEFAULT_DURATIONS[variant], 
      link 
    } = options;

    // Fix for S6582: Using optional chaining for a more concise check.
    // We use (lastToast?.createdAt ?? 0) to satisfy strict math operations.
    const [lastToast] = this.items();
    
    if (lastToast?.message === message && Date.now() - (lastToast?.createdAt ?? 0) < 2000) {
      return lastToast.id;
    }

    const id = crypto.randomUUID();

    const toast: ToastItem = {
      id,
      message,
      title,
      variant,
      dismissible,
      durationMs,
      link,
      createdAt: Date.now(),
    };

    this.items.update(prev => [toast, ...prev]);

    if (durationMs && durationMs > 0) {
      const timer = setTimeout(() => this.dismiss(id), durationMs);
      this.timers.set(id, timer);
    }

    return id;
  }

  // --- Shorthands ---

  info(messageOrOptions: string | ToastOptions, options: Partial<ToastOptions> = {}): string {
    return this.prepareAndShow('info', messageOrOptions, options);
  }

  success(messageOrOptions: string | ToastOptions, options: Partial<ToastOptions> = {}): string {
    return this.prepareAndShow('success', messageOrOptions, options);
  }

  warning(messageOrOptions: string | ToastOptions, options: Partial<ToastOptions> = {}): string {
    return this.prepareAndShow('warning', messageOrOptions, options);
  }

  error(messageOrOptions: string | ToastOptions, options: Partial<ToastOptions> = {}): string {
    return this.prepareAndShow('error', messageOrOptions, options);
  }

  dismiss(id: string): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    this.items.update(prev => prev.filter(item => item.id !== id));
  }

  clear(): void {
    this.timers.forEach(clearTimeout);
    this.timers.clear();
    this.items.set([]);
  }

  private prepareAndShow(
    variant: ToastVariant, 
    messageOrOptions: string | ToastOptions, 
    extra: Partial<ToastOptions>
  ): string {
    const baseOptions = typeof messageOrOptions === 'string' 
      ? { message: messageOrOptions, ...extra } 
      : messageOrOptions;

    return this.show({ ...baseOptions, variant });
  }
}