/**
 * WebSocket / real-time configuration constants
 */

export const REALTIME_CONFIG = {
  maxReconnectAttempts: 5,
  reconnectDelayMs: 1000,
  heartbeatIntervalMs: 30000,
} as const;
