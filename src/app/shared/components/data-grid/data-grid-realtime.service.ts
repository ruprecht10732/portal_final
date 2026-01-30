/**
 * Data Grid Real-Time Service
 * WebSocket-based real-time updates for the data grid
 */

import { Injectable, OnDestroy, signal, computed, inject } from '@angular/core';
import { RealTimeUpdate, RowState } from './data-grid.types';
import { ErrorReportingService } from '../../../core/services/error-reporting.service';

export interface RealTimeConfig {
  /** WebSocket URL to connect to */
  url: string;
  /** Reconnection attempts before giving up */
  maxReconnectAttempts?: number;
  /** Base delay between reconnection attempts (ms) */
  reconnectDelay?: number;
  /** Enable heartbeat/ping mechanism */
  enableHeartbeat?: boolean;
  /** Heartbeat interval (ms) */
  heartbeatInterval?: number;
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

@Injectable()
export class DataGridRealtimeService<T extends object> implements OnDestroy {
  private readonly reporter = inject(ErrorReportingService);
  private socket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private config: RealTimeConfig | null = null;
  
  /** Current connection state */
  readonly connectionState = signal<ConnectionState>('disconnected');
  
  /** Pending updates received while editing */
  readonly pendingUpdates = signal<RealTimeUpdate<T>[]>([]);
  
  /** Whether there are conflicts between local edits and server updates */
  readonly hasConflicts = signal(false);
  
  /** Last error message */
  readonly lastError = signal<string | null>(null);
  
  /** Is currently connected */
  readonly isConnected = computed(() => this.connectionState() === 'connected');
  
  /** Update callback - set by the store */
  private updateCallback: ((update: RealTimeUpdate<T>) => void) | null = null;

  /**
   * Connect to WebSocket server
   */
  connect(config: RealTimeConfig): void {
    this.config = {
      maxReconnectAttempts: 5,
      reconnectDelay: 1000,
      enableHeartbeat: true,
      heartbeatInterval: 30000,
      ...config,
    };
    
    this.initiateConnection();
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.cleanup();
    this.connectionState.set('disconnected');
    this.pendingUpdates.set([]);
    this.hasConflicts.set(false);
    this.lastError.set(null);
  }

  /**
   * Register callback for incoming updates
   */
  onUpdate(callback: (update: RealTimeUpdate<T>) => void): void {
    this.updateCallback = callback;
    
    // Process any pending updates
    const pending = this.pendingUpdates();
    if (pending.length > 0 && callback) {
      pending.forEach(callback);
      this.pendingUpdates.set([]);
    }
  }

  /**
   * Send message to server (e.g., subscription changes)
   */
  send(message: unknown): boolean {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  /**
   * Check for conflicts between local edits and incoming update
   */
  checkConflict(
    row: RowState<T>,
    update: RealTimeUpdate<T>
  ): { hasConflict: boolean; conflictingFields: string[] } {
    if (!row.dirty || update.type !== 'update' || !update.data) {
      return { hasConflict: false, conflictingFields: [] };
    }

    const conflictingFields: string[] = [];
    const updateData = update.data;
    
    // Compare each field that was changed locally
    for (const key in row.current) {
      if (Object.hasOwn(row.current, key)) {
        const localValue = row.current[key];
        const originalValue = row.original[key];
        const serverValue = updateData[key as keyof T];
        
        // Field was modified locally
        if (localValue !== originalValue) {
          // Server also changed this field to a different value
          if (serverValue !== undefined && serverValue !== localValue) {
            conflictingFields.push(key);
          }
        }
      }
    }

    return {
      hasConflict: conflictingFields.length > 0,
      conflictingFields,
    };
  }

  /**
   * Queue an update for later processing (when editing completes)
   */
  queueUpdate(update: RealTimeUpdate<T>): void {
    this.pendingUpdates.update(updates => [...updates, update]);
  }

  /**
   * Process all queued updates
   */
  processQueuedUpdates(): void {
    const pending = this.pendingUpdates();
    if (pending.length > 0 && this.updateCallback) {
      pending.forEach(this.updateCallback);
      this.pendingUpdates.set([]);
    }
  }

  /**
   * Clear conflicts flag
   */
  clearConflicts(): void {
    this.hasConflicts.set(false);
  }

  ngOnDestroy(): void {
    this.disconnect();
  }

  private initiateConnection(): void {
    if (!this.config) return;
    
    this.cleanup();
    this.connectionState.set(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting');
    
    try {
      this.socket = new WebSocket(this.config.url);
      this.setupSocketHandlers();
    } catch (error) {
      this.handleConnectionError(error);
    }
  }

  private setupSocketHandlers(): void {
    if (!this.socket) return;

    this.socket.onopen = () => {
      this.connectionState.set('connected');
      this.reconnectAttempts = 0;
      this.lastError.set(null);
      
      if (this.config?.enableHeartbeat) {
        this.startHeartbeat();
      }
    };

    this.socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data as string);
        this.handleMessage(message);
      } catch (error) {
        this.reporter.report(error, { source: 'runtime', silent: true, userMessage: 'Failed to parse WebSocket message' });
      }
    };

    this.socket.onclose = (event) => {
      this.stopHeartbeat();
      
      if (event.wasClean) {
        this.connectionState.set('disconnected');
      } else {
        this.attemptReconnect();
      }
    };

    this.socket.onerror = (error) => {
      this.lastError.set('WebSocket connection error');
      this.connectionState.set('error');
      this.reporter.report(error, { source: 'runtime', userMessage: 'WebSocket connection error' });
    };
  }

  private handleMessage(message: unknown): void {
    // Handle different message types
    if (this.isRealTimeUpdate(message)) {
      if (this.updateCallback) {
        this.updateCallback(message);
      } else {
        this.queueUpdate(message);
      }
    } else if (this.isPongMessage(message)) {
      // Heartbeat response - connection is alive
    }
  }

  private isRealTimeUpdate(message: unknown): message is RealTimeUpdate<T> {
    return (
      typeof message === 'object' &&
      message !== null &&
      'type' in message &&
      ['create', 'update', 'delete'].includes((message as RealTimeUpdate<T>).type)
    );
  }

  private isPongMessage(message: unknown): boolean {
    return (
      typeof message === 'object' &&
      message !== null &&
      'type' in message &&
      (message as { type: string }).type === 'pong'
    );
  }

  private attemptReconnect(): void {
    if (!this.config) return;
    
    const maxAttempts = this.config.maxReconnectAttempts ?? 5;
    
    if (this.reconnectAttempts >= maxAttempts) {
      this.connectionState.set('error');
      const message = `Failed to reconnect after ${maxAttempts} attempts`;
      this.lastError.set(message);
      this.reporter.report(new Error(message), { source: 'runtime', userMessage: message });
      return;
    }

    this.reconnectAttempts++;
    const delay = (this.config.reconnectDelay ?? 1000) * Math.pow(2, this.reconnectAttempts - 1);
    
    this.connectionState.set('reconnecting');
    
    this.reconnectTimeout = setTimeout(() => {
      this.initiateConnection();
    }, delay);
  }

  private startHeartbeat(): void {
    if (!this.config?.enableHeartbeat) return;
    
    const interval = this.config.heartbeatInterval ?? 30000;
    
    this.heartbeatInterval = setInterval(() => {
      this.send({ type: 'ping' });
    }, interval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private cleanup(): void {
    this.stopHeartbeat();
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.socket) {
      this.socket.onopen = null;
      this.socket.onmessage = null;
      this.socket.onclose = null;
      this.socket.onerror = null;
      
      if (this.socket.readyState === WebSocket.OPEN || 
          this.socket.readyState === WebSocket.CONNECTING) {
        this.socket.close();
      }
      this.socket = null;
    }
  }

  private handleConnectionError(error: unknown): void {
    const message = error instanceof Error ? error.message : 'Connection failed';
    this.lastError.set(message);
    this.connectionState.set('error');
    this.reporter.report(error, { source: 'runtime', userMessage: message });
    this.attemptReconnect();
  }
}
