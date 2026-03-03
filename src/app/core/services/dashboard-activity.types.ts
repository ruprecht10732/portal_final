/** Event categories for the activity feed filter toggles. */
export type ActivityCategory = 'leads' | 'quotes' | 'appointments' | 'ai';

/** A single item in the real-time activity feed. */
export interface ActivityEvent {
  /** Unique id (SSE events don't have one so we generate a client-side uuid). */
  id: string;
  /** The raw SSE event type. */
  type: string;
  /** High-level category used for filtering. */
  category: ActivityCategory;
  /** Human-readable title, e.g. "Nieuwe lead aangemaakt". */
  title: string;
  /** Optional secondary description. */
  description?: string | undefined;
  /** ISO-8601 timestamp. */
  timestamp: string;
  /** Optional link to navigate to the relevant detail page. */
  link?: string[] | undefined;
  /** Arbitrary payload forwarded from SSE. */
  data?: Record<string, unknown> | undefined;
}
