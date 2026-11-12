import { getTranslations } from 'next-intl/server';
import { locale as rootLocale } from 'next/root-params';

import { owner } from '@/config/site';
import { Link } from '@/i18n/navigation';
import { isAppLocale } from '@/i18n/routing';
import { getContent, titleFontFamily } from '@/lib/content';

import { DesktopNav } from './desktop-nav';
import { HeaderFrame } from './header-frame';
import { HeaderLinks } from './header-links';
import { LanguageSwitcher } from './language-switcher';
import { MobileMenu } from './mobile-menu';
import { Monogram } from './monogram';
import { TerminalToggle } from './terminal-toggle';

export async function Header(): Promise<React.JSX.Element> {
  const t = await getTranslations('header');
  const links = await HeaderLinks();
  const locale = await rootLocale();
  const profile = isAppLocale(locale) ? await getContent().getProfile(locale) : null;
  const titleFont = profile?.titleFont;

  return (
    <HeaderFrame>
      <div className="container-page flex h-(--header-height) items-center justify-between gap-4">
        <Link
          href={{ pathname: '/', hash: 'top' }}
          aria-label={t('homeLabel', { name: owner.shortName })}
          className="-ml-1 inline-flex min-h-11 items-center gap-2.5 rounded-full pr-2 pl-1"
        >
          <Monogram />
          <span
            aria-hidden="true"
            data-header-name
            style={titleFont ? { fontFamily: titleFontFamily(titleFont) } : undefined}
            className={`hidden text-[0.9375rem] tracking-[-0.01em] text-text-1 transition-opacity duration-300 motion-reduce:transition-none min-[400px]:inline ${
              titleFont ? 'font-normal [font-synthesis:none]' : 'font-semibold'
            }`}
          >
            {owner.shortName}
          </span>
        </Link>

        <DesktopNav />

        <div className="flex items-center gap-2">
          {links ? <div className="hidden md:block">{links}</div> : null}
          <LanguageSwitcher />
          <div className="max-md:hidden">
            <TerminalToggle />
          </div>
          <MobileMenu links={links} />
        </div>
      </div>
    </HeaderFrame>
  );
}
