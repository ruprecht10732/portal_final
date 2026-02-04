import { computed, Injectable, signal } from '@angular/core';
import { TOAST_DURATION_MS } from '../config';

export type ToastVariant = 'info' | 'success' | 'warning' | 'error';

export interface ToastLink {
  label: string;
  url: string | string[]; // Can be a string or router link segments
}

export interface ToastItem {
  id: string;
  message: string;
  title?: string;
  variant: ToastVariant;
  dismissible: boolean;
  durationMs: number | null;
  createdAt: number;
  link?: ToastLink;
}

export interface ToastOptions {
  message: string;
  title?: string;
  variant?: ToastVariant;
  dismissible?: boolean;
  durationMs?: number | null;
  link?: ToastLink;
}

const DEFAULT_DURATIONS: Record<ToastVariant, number> = TOAST_DURATION_MS;

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly items = signal<ToastItem[]>([]);
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  readonly toasts = computed(() => this.items());

  show(options: ToastOptions): string {
    const variant = options.variant ?? 'info';
    const dismissible = options.dismissible ?? true;
    const durationMs = options.durationMs === undefined ? DEFAULT_DURATIONS[variant] : options.durationMs;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const toast: ToastItem = {
      id,
      message: options.message,
      ...(options.title !== undefined && { title: options.title }),
      variant,
      dismissible,
      durationMs,
      createdAt: Date.now(),
      ...(options.link !== undefined && { link: options.link }),
    };

    this.items.update(current => [toast, ...current]);

    if (durationMs && durationMs > 0) {
      const timer = setTimeout(() => {
        this.dismiss(id);
      }, durationMs);
      this.timers.set(id, timer);
    }

    return id;
  }

  info(message: string, title?: string): string {
    return this.show({ message, ...(title !== undefined && { title }), variant: 'info' });
  }

  success(message: string, title?: string): string {
    return this.show({ message, ...(title !== undefined && { title }), variant: 'success' });
  }

  warning(message: string, title?: string): string {
    return this.show({ message, ...(title !== undefined && { title }), variant: 'warning' });
  }

  error(message: string, title?: string): string {
    return this.show({ message, ...(title !== undefined && { title }), variant: 'error' });
  }

  dismiss(id: string): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }

    this.items.update(current => current.filter(item => item.id !== id));
  }

  clear(): void {
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
    this.items.set([]);
  }
}
