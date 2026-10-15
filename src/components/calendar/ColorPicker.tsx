import { Check } from 'lucide-react';
import { PALETTE } from '@/lib/data/types';
import { cn } from '@/lib/utils';

export function ColorPicker({ value, onChange, allowNone, noneColor }: {
  value: string | null;
  onChange: (color: string | null) => void;
  /** Offer a "use the calendar's color" swatch. */
  allowNone?: boolean;
  noneColor?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {allowNone && (
        <button
          type="button"
          onClick={() => onChange(null)}
          title="Use the category or calendar color"
          className={cn(
            'h-7 rounded-full border border-border-default px-2 text-[11px] text-foreground-de-emphasis',
            value === null && 'ring-2 ring-offset-2 ring-offset-surface-elevated ring-foreground-emphasis'
          )}
        >
          <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ backgroundColor: noneColor }} />
          Default
        </button>
      )}
      {PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          aria-label={`Color ${c}`}
          className="flex h-7 w-7 items-center justify-center rounded-full"
          style={{ backgroundColor: c }}
        >
          {value === c && <Check className="h-4 w-4 text-white" />}
        </button>
      ))}
    </div>
  );
}
