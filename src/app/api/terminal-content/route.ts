import { NextResponse } from 'next/server';

import { isAppLocale } from '@/i18n/routing';
import { getContent } from '@/lib/content';
import { buildSnapshot } from '@/lib/terminal/snapshot';

/**
 * Public, read-only snapshot for the terminal; hidden items never appear.
 */
export async function GET(request: Request): Promise<NextResponse<unknown>> {
  const locale = new URL(request.url).searchParams.get('locale');

  if (!isAppLocale(locale)) {
    return new NextResponse(null, { status: 404 });
  }

  const content = getContent();
  const [profile, contact, resume, links, recommended, projects, experience, education, skills] =
    await Promise.all([
      content.getProfile(locale),
      content.getContact(locale),
      content.getResume(),
      content.getFeaturedLinks(locale),
      content.getRecommendedProfiles(locale),
      content.getProjects(locale),
      content.getExperience(locale),
      content.getEducation(locale),
      content.getSkills(locale),
    ]);

  return NextResponse.json(
    buildSnapshot({
      locale,
      profile,
      contact,
      resume,
      links,
      recommended,
      projects,
      experience,
      education,
      skills,
    }),
    {
      // Admin saves cannot purge a CDN copy of this route, so never keep one:
      // hidden items must disappear at once. The content reads are tag-cached.
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
