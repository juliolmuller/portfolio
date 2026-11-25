'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { smallButton } from './styles';

/**
 * Hint under a picker whose options are documents of another area: link to that
 * area in a new tab, then re-read the options without losing unsaved edits.
 */
export function PickHint({ href, label }: { href: string; label: string }): React.JSX.Element {
  const router = useRouter();

  return (
    <>
      Missing one? Add it in{' '}
      <Link href={href} target="_blank" prefetch={false} className="underline">
        {label} (opens in a new tab)
      </Link>
      , then {/* refresh() re-reads the options on the server and keeps the unsaved form state. */}
      <button type="button" onClick={() => router.refresh()} className={smallButton}>
        Refresh the list
      </button>
    </>
  );
}
