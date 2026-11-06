import '@/styles/globals.css';

import { type Metadata, type Viewport } from 'next';

import { AdminShell } from '@/components/admin/shell';
import { Toaster } from '@/components/ui/toaster';
import { THEME_COLOR } from '@/config/site';
import { requireAdmin } from '@/lib/auth/session';
import { fontVariables } from '@/styles/fonts';
import { titleFontVariables } from '@/styles/title-fonts';

export const metadata: Metadata = {
  title: 'Admin',
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true,
    noimageindex: true,
    notranslate: true,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  colorScheme: 'dark',
  themeColor: THEME_COLOR,
};

export default async function AdminLayout({
  children,
}: LayoutProps<'/admin'>): Promise<React.JSX.Element> {
  const session = await requireAdmin();

  return (
    <html lang="en" className={`${fontVariables} ${titleFontVariables}`}>
      <body>
        <AdminShell expiresAt={session.exp * 1000}>{children}</AdminShell>
        <Toaster />
      </body>
    </html>
  );
}
