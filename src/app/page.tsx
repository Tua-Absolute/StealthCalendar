'use client';

import dynamic from 'next/dynamic';

// Rendered only in the browser: dates depend on the viewer's time zone, not the server's.
const CalendarApp = dynamic(() => import('@/components/calendar/CalendarApp').then((m) => m.CalendarApp), {
  ssr: false,
  loading: () => <div className="h-[100dvh] bg-surface" />,
});

export default function Home() {
  return <CalendarApp />;
}
