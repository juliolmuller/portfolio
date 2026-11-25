import { getTranslations } from 'next-intl/server';

import { TechCloudShell } from '@/components/tech-cloud/tech-cloud-shell';
import { toStackItems } from '@/components/tech-cloud/to-stack-items';
import { SectionHeader } from '@/components/ui/section-header';
import { type Skill } from '@/lib/content';

/**
 * Stack section, fed by skills only (#74): List is the SSR / reduced-motion
 * baseline (every visible skill); the geoid cloud is a client enhancement (D37)
 * showing the `inCloud` ones.
 */
export async function Stack({ skills }: { skills: Skill[] }): Promise<React.JSX.Element> {
  const t = await getTranslations('stack');
  const { items, cloudItems } = toStackItems(skills);

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
      <TechCloudShell items={items} cloudItems={cloudItems} />
    </section>
  );
}
