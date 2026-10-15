import { cn } from '@/lib/utils';
import { HTMLAttributes, forwardRef } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated';
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-2xl p-6',
        variant === 'default'
          ? 'bg-surface-container border border-border-default'
          : 'bg-surface-elevated shadow-lg',
        className
      )}
      {...props}
    />
  )
);
Card.displayName = 'Card';

export { Card };
