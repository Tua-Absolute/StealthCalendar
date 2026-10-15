import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { View } from '@/lib/calendar/dates';

interface ViewState {
  view: View;
  cursor: Date;
  setView: (view: View) => void;
  setCursor: (cursor: Date) => void;
}

export const useViewStore = create<ViewState>()(
  persist(
    (set) => ({
      view: 'month',
      cursor: new Date(),
      setView: (view) => set({ view }),
      setCursor: (cursor) => set({ cursor }),
    }),
    // Only the view is remembered; the calendar always opens on today.
    { name: 'stealth-calendar-view', partialize: (s) => ({ view: s.view }) }
  )
);
