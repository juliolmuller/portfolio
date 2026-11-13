'use client';

import { type ReactNode, type ToggleEvent, useState } from 'react';

/**
 * Native `<details>` whose initial state comes from the experience's
 * `collapsedByDefault` (D89). Visitors toggle it freely; the prop is not
 * resynced after mount.
 */
export function JobDetails({
  openByDefault,
  className,
  children,
}: {
  children: ReactNode;
  className?: string;
  openByDefault: boolean;
}): React.JSX.Element {
  const [open, setOpen] = useState(openByDefault);

  function onToggle(event: ToggleEvent<HTMLDetailsElement>): void {
    setOpen(event.currentTarget.open);
  }

  return (
    <details className={className} open={open} onToggle={onToggle}>
      {children}
    </details>
  );
}
