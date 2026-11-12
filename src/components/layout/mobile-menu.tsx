'use client';

import { Menu, Terminal, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type CSSProperties, type ReactNode, useEffect, useId, useRef, useState } from 'react';

import { buttonVariants } from '@/components/ui/button';
import { openTerminal } from '@/components/window-manager/terminal-controls';
import { Link, usePathname } from '@/i18n/navigation';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/cn';

import { MotionToggle } from './motion-toggle';
import { NAV_SECTIONS } from './nav-items';

/**
 * Full-screen menu below 768px. A native modal `<dialog>` gives the focus trap,
 * Esc and inert background; the page scroll is locked only while open. The
 * footer holds the terminal item (the header button is hidden below `md`,
 * D82).
 */
export function MobileMenu({ links }: { links?: ReactNode }): React.JSX.Element {
  const t = useTranslations('header');
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const pendingTerminalRef = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();

    if (!open && dialog.open) dialog.close();

    const root = document.documentElement;

    if (open) root.style.overflow = 'hidden';

    return (): void => {
      root.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const desktop = window.matchMedia('(min-width: 48rem)');
    const onChange = (): false | void => desktop.matches && setOpen(false);

    desktop.addEventListener('change', onChange);

    return (): void => desktop.removeEventListener('change', onChange);
  }, [open]);

  const close = (): void => setOpen(false);

  // Open the terminal only once the dialog has left the top layer, otherwise
  // the sheet would be inert behind it.
  const onDialogClose = (): void => {
    setOpen(false);

    if (!pendingTerminalRef.current) return;

    pendingTerminalRef.current = false;
    requestAnimationFrame(() => openTerminal());
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t('openMenu')}
        className="inline-flex size-11 items-center justify-center rounded-full text-text-1 md:hidden hover-fine:bg-surface-1"
      >
        <Menu aria-hidden="true" className="size-5" />
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onClose={onDialogClose}
        className="z-(--z-menu) m-0 h-dvh max-h-none w-full max-w-none bg-bg-0/95 p-0 text-text-2 backdrop-blur-xl backdrop:bg-transparent open:flex open:flex-col"
      >
        <div className="container-page flex h-(--header-height) shrink-0 items-center justify-between">
          <h2 id={titleId} className="font-label text-text-3">
            {t('menuTitle')}
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label={t('closeMenu')}
            className="inline-flex size-11 items-center justify-center rounded-full text-text-1 hover-fine:bg-surface-1"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>

        <nav
          aria-label={t('primaryNav')}
          className="container-page flex flex-1 flex-col justify-center overflow-y-auto py-8"
        >
          <ul className="flex flex-col gap-1">
            {pathname !== '/' ? (
              <li className="animate-[menu-item-in_500ms_var(--ease-out-expo)_both]">
                <Link
                  href={{ pathname: '/', hash: 'work' }}
                  onClick={close}
                  className="inline-flex min-h-11 items-center text-small text-text-2"
                >
                  {t('backToWork')}
                </Link>
              </li>
            ) : null}
            {NAV_SECTIONS.map((section, index) => (
              <li
                key={section}
                className="animate-[menu-item-in_500ms_var(--ease-out-expo)_both] [animation-delay:var(--delay)]"
                style={{ '--delay': `${60 + index * 60}ms` } as CSSProperties}
              >
                <Link
                  href={{ pathname: '/', hash: section }}
                  onClick={close}
                  className="inline-flex min-h-14 items-center text-[clamp(2rem,9vw,2.75rem)] leading-tight font-semibold tracking-[-0.03em] text-text-1"
                >
                  {t(`nav.${section}`)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="container-page flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-line py-5 safe-bottom">
          <button
            type="button"
            onClick={() => {
              track('terminal_open', { source: 'menu' });
              pendingTerminalRef.current = true;
              close();
            }}
            className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }))}
          >
            <Terminal aria-hidden="true" />
            {t('openTerminal')}
          </button>
          {links}
          <MotionToggle />
        </div>
      </dialog>
    </>
  );
}
