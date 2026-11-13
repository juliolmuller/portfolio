'use client';

import { Analytics } from '@vercel/analytics/next';
import { useEffect } from 'react';

import { track } from '@/lib/analytics';

/**
 * Mounts Web Analytics, plus one delegated listener covers every link the
 * server renders (header, contact, resume), so those components stay
 * untouched.
 */
export function ClickTracker(): React.JSX.Element {
  useEffect(() => {
    function onClick(event: MouseEvent): void {
      const anchor = (event.target as Element | null)?.closest?.('a[href]');

      if (!anchor) return;

      const href = anchor.getAttribute('href') ?? '';

      if (href.startsWith('mailto:')) return track('email_click');

      if (/^\/[a-z-]+\/resume$/.test(href)) {
        return track('resume_open', { locale: href.split('/')[1]! });
      }

      try {
        const url = new URL(href, window.location.href);

        if (url.origin !== window.location.origin) {
          track('external_link', { host: url.hostname });
        }
      } catch {
        // Malformed href: nothing to track.
      }
    }
    document.addEventListener('click', onClick);

    return (): void => document.removeEventListener('click', onClick);
  }, []);

  // No admin filter: /admin has its own root layout, which never mounts this.
  return <Analytics />;
}
