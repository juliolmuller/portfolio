import { getTranslations } from 'next-intl/server';

import { TechCloudShell } from '@/components/tech-cloud/tech-cloud-shell';
import { type StackTech } from '@/components/tech-cloud/types';
import { SectionHeader } from '@/components/ui/section-header';
import { type Practice, type Technology } from '@/lib/content';
import { toPublicIcon } from '@/lib/content/icon-src';

/**
 * Only what the client needs: icon URLs, never paths (D59).
 */
function toStackTech(tech: Technology): StackTech {
  return {
    id: tech.id,
    name: tech.name,
    categories: [tech.category],
    icon: toPublicIcon(tech.icon),
    brandColor: tech.brandColor,
    url: tech.url,
    priority: tech.priority,
  };
}

/**
 * Stack section: List is the SSR / reduced-motion baseline; the geoid cloud is
 * a client enhancement (D37).
 */
export async function Stack({
  technologies,
  practices,
}: {
  practices: Practice[];
  technologies: Technology[];
}): Promise<React.JSX.Element> {
  const t = await getTranslations('stack');

  return (
    <section
      id="stack"
      aria-labelledby="stack-title"
      className="overflow-x-clip border-y border-line bg-bg-1 section-y"
    >
      <div className="container-page">
        <SectionHeader
          id="stack-title"
          index={2}
          eyebrow={t('eyebrow')}
          title={t('title')}
          lead={t('lead')}
        />
      </div>
      <TechCloudShell technologies={technologies.map(toStackTech)} practices={practices} />
    </section>
  );
}
