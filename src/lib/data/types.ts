export type CalendarSource = 'local' | 'ics' | 'google' | 'outlook';

export interface CalendarRow {
  id: string;
  user_id: string;
  name: string;
  color: string;
  source: CalendarSource;
  external_id: string | null;
  visible: boolean;
  created_at: string;
}

export interface EventRow {
  id: string;
  user_id: string;
  calendar_id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  color: string | null;
  uid: string | null;
  category_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CategoryRow {
  id: string;
  user_id: string;
  name: string;
  color: string;
  visible: boolean;
  created_at: string;
}

/** Fields the app writes when creating or editing an event. */
export interface EventInput {
  id?: string;
  calendar_id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  color?: string | null;
  category_id?: string | null;
}

export const PALETTE = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#a1a1aa', // gray
] as const;
