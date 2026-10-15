'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarDays, LogOut, Moon, Sun } from 'lucide-react';
import { useThemeStore } from '@/store/theme';
import { createClient } from '@/lib/supabase/client';

export function Header({ children }: { children?: React.ReactNode }) {
  const { theme, toggleTheme } = useThemeStore();
  const router = useRouter();

  const signOut = async () => {
    await createClient().auth.signOut();
    router.replace('/login');
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-red-500/20 bg-surface/80 backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 flex-shrink-0">
          <CalendarDays className="h-6 w-6 text-red-500" />
          <span className="text-lg font-semibold text-foreground-emphasis hidden sm:block">
            Stealth<span className="text-red-500">Calendar</span>
          </span>
        </Link>
        <div className="flex flex-1 items-center justify-end gap-1">
          {children}
          <button onClick={toggleTheme} className="icon-button" aria-label="Toggle theme">
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <button onClick={signOut} className="icon-button" aria-label="Sign out" title="Sign out">
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
