import Link from 'next/link';
import { type ReactNode } from 'react';

import { getAdminStore } from '@/lib/content/admin';

import { AdminNav } from './admin-nav';
import { SessionControls } from './session-controls';

export async function AdminShell({
  expiresAt,
  children,
}: {
  children: ReactNode;
  expiresAt: number;
}): Promise<React.JSX.Element> {
  const source = getAdminStore().label;

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[14rem_1fr]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-(--z-skip-link) focus:rounded-md focus:bg-surface-2 focus:p-3"
      >
        Skip to content
      </a>
      <aside className="hidden border-r border-line md:block">
        <p className="p-4 font-mono text-small text-text-1">julio · admin</p>
        <AdminNav />
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-col pb-14 md:pb-0">
        <header className="flex flex-wrap items-center justify-end gap-3 border-b border-line px-4 py-2">
          <span className="mr-auto rounded-full border border-line px-3 py-1 text-xs text-text-2">
            {source}
          </span>
          <Link
            href="/"
            prefetch={false}
            className="inline-flex min-h-11 items-center text-small text-text-2 hover-fine:text-text-1"
          >
            View site
          </Link>
          <SessionControls expiresAt={expiresAt} />
        </header>
        <main id="main" tabIndex={-1} className="flex-1 p-4 outline-none md:p-8">
          {children}
        </main>
      </div>

      <AdminNav className="fixed inset-x-0 bottom-0 z-20 overflow-x-auto border-t border-line bg-bg-1 pb-[env(safe-area-inset-bottom)] md:hidden" />
    </div>
  );
}
