import { ArrowRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { nameLookup } from '@/components/portfolio/names';
import { ProjectCard } from '@/components/portfolio/project-card';
import { ButtonLink } from '@/components/ui/button';
import { Reveal } from '@/components/ui/reveal';
import { SectionHeader } from '@/components/ui/section-header';
import { type ProjectSummary, type Skill } from '@/lib/content';

export async function Work({
  projects,
  skills,
}: {
  projects: ProjectSummary[];
  skills: Skill[];
}): Promise<React.JSX.Element> {
  const t = await getTranslations('work');
  const namesFor = nameLookup(skills);

  return (
    <section id="work" aria-labelledby="work-title" className="section-y">
      <div className="container-page">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeader
            id="work-title"
            index={3}
            eyebrow={t('eyebrow')}
            title={t('title')}
            lead={t('lead')}
            className="mb-0 md:mb-0"
          />
          <ButtonLink href="/projects" variant="secondary">
            {t('allProjects')}
            <ArrowRight aria-hidden="true" />
          </ButtonLink>
        </div>

        <ul className="mt-12 grid gap-6 min-[1100px]:grid-cols-3 md:mt-16 md:grid-cols-2">
          {projects.map((project, index) => (
            <li key={project.id}>
              <Reveal index={index % 3} className="h-full">
                <ProjectCard project={project} skillNames={namesFor(project.skillIds)} />
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
