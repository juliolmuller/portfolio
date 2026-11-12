'use client';

import { CheckCircle2, CircleAlert, Info } from 'lucide-react';

import { cn } from '@/lib/cn';
import { useToastStore } from '@/stores/toast-store';

const icons = { neutral: Info, success: CheckCircle2, error: CircleAlert };

const positions = {
  bottom: 'bottom-[calc(1rem+env(safe-area-inset-bottom))]',
  top: 'top-[calc(1rem+env(safe-area-inset-top))] [--toast-from:-8px]',
} as const;

/**
 * Polite live region for toasts. Always mounted so announcements fire.
 *
 * `top` is used by the admin, whose sticky form action bar and mobile nav
 * occupy the bottom of the viewport; the public site and /dev use the default
 * `bottom`.
 */
export function Toaster({
  position = 'bottom',
}: { position?: 'bottom' | 'top' } = {}): React.JSX.Element {
  const toasts = useToastStore((state) => state.toasts);

  return (
    <div
      role="status"
      aria-live="polite"
      data-toaster=""
      data-position={position}
      className={cn(
        'pointer-events-none fixed inset-x-0 z-(--z-toast) flex flex-col items-center gap-2 px-4',
        positions[position],
      )}
    >
      {toasts.map((item) => {
        const Glyph = icons[item.tone];

        return (
          <p
            key={item.id}
            className={cn(
              'flex animate-[toast-in_250ms_var(--ease-out-expo)] items-center gap-2 rounded-full border border-line-strong bg-surface-2 px-4 py-2',
              'text-small text-text-1 shadow-(--shadow-window)',
            )}
          >
            <Glyph
              aria-hidden="true"
              className={cn(
                'size-4',
                item.tone === 'success' && 'text-term-green',
                item.tone === 'error' && 'text-danger',
                item.tone === 'neutral' && 'text-accent-2',
              )}
            />
            {item.message}
          </p>
        );
      })}
    </div>
  );
}
