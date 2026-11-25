import { ArrowUpRight, ChevronDown, FileText } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { LinkIcon } from '@/components/content/link-icon';
import { TimelineProgress } from '@/components/motion/timeline-progress';
import { Chip } from '@/components/ui/chip';
import { Reveal } from '@/components/ui/reveal';
import { SectionHeader } from '@/components/ui/section-header';
import { type AppLocale, localeTags, routing } from '@/i18n/routing';
import {
  type Education,
  type Experience as ExperienceEntry,
  type ExperienceRole,
  type FeaturedLink,
  type Resume as ResumeFiles,
  type Skill,
} from '@/lib/content';
import { formatPartialDate } from '@/lib/format';

import { JobDetails } from './job-details';
import { externalRel } from './links';
import { ResumePanes } from './resume-panes';
import { RoleSummary, type ToggleLabels } from './role-summary';

interface ResumeProps {
  education: Education[];
  experience: ExperienceEntry[];
  links: FeaturedLink[];
  locale: AppLocale;
  resume: null | ResumeFiles;
  skills: Skill[];
}

const linkClass =
  'inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-4 text-small text-text-1 transition-colors hover-fine:border-line-strong hover-fine:bg-surface-1';

function ownLinkedIn(links: FeaturedLink[]): FeaturedLink | undefined {
  return links.find(
    (link) =>
      link.isOwnProfile
      && (link.url.toLowerCase().includes('linkedin')
        || link.id.toLowerCase().includes('linkedin')),
  );
}

function DateRange({
  locale,
  start,
  end,
  presentLabel,
}: {
  end?: string;
  locale: AppLocale;
  presentLabel?: string;
  start?: string;
}): null | React.JSX.Element {
  if (!start && !end) return null;

  const showEnd = Boolean(end) || Boolean(presentLabel);

  return (
    <span className="font-mono text-[0.8125rem] text-text-3">
      {start ? <time dateTime={start}>{formatPartialDate(locale, start)}</time> : null}
      {start && showEnd ? ' – ' : null}
      {end ? <time dateTime={end}>{formatPartialDate(locale, end)}</time> : presentLabel}
    </span>
  );
}

function SkillChips({
  ids,
  names,
  label,
  className,
}: {
  className?: string;
  ids: string[];
  label: string;
  names: Map<string, string>;
}): null | React.JSX.Element {
  const items = ids.flatMap((id) => {
    const name = names.get(id);

    return name ? [{ id, name }] : [];
  });

  if (items.length === 0) return null;

  return (
    <div className={className}>
      <p className="sr-only">{label}</p>
      <ul className="flex flex-wrap gap-2">
        {items.map(({ id, name }) => (
          <li key={id}>
            <Chip>{name}</Chip>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RoleBody({
  role,
  labels,
}: {
  labels: ToggleLabels;
  role: ExperienceRole;
}): React.JSX.Element {
  return (
    <>
      <RoleSummary text={role.summary} title={role.title} labels={labels} />
      {role.bullets.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {role.bullets.map((bullet) => (
            <li key={bullet} className="flex gap-3 text-text-2">
              <span
                aria-hidden="true"
                className="mt-[0.7em] size-1 shrink-0 rounded-full bg-accent-2"
              />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

export async function Resume({
  locale,
  experience,
  education,
  skills,
  resume,
  links,
}: ResumeProps): Promise<React.JSX.Element> {
  const [t, tA11y, tHeader] = await Promise.all([
    getTranslations('resume'),
    getTranslations('a11y'),
    getTranslations('header'),
  ]);
  const names = new Map(skills.map((skill) => [skill.id, skill.name]));
  const labels = { more: t('more'), less: t('less') };
  const linkedIn = ownLinkedIn(links);
  const resumeLocales = [locale, ...routing.locales.filter((other) => other !== locale)].filter(
    (candidate) => resume?.files[candidate],
  );

  const experiencePane =
    experience.length > 0 ? (
      <div id="experience">
        <TimelineProgress>
          <ol className="space-y-4">
            {experience.map((entry) => {
              const [first, ...rest] = entry.roles;
              const details = (
                <>
                  {first ? <RoleBody role={first} labels={labels} /> : null}
                  {rest.map((role) => (
                    <div key={`${role.title}-${role.start}`} className="mt-8">
                      <h4 className="font-semibold text-text-1">{role.title}</h4>
                      <DateRange
                        locale={locale}
                        start={role.start}
                        end={role.end}
                        presentLabel={t('present')}
                      />
                      <RoleBody role={role} labels={labels} />
                    </div>
                  ))}
                  <SkillChips
                    ids={entry.skillIds}
                    names={names}
                    label={t('skills')}
                    className="mt-5"
                  />
                </>
              );

              return (
                <li key={entry.id} className="relative pl-10">
                  <span
                    data-timeline-node
                    aria-hidden="true"
                    className="absolute top-[0.85rem] left-0 size-[15px] rounded-full border-2 border-bg-0 bg-surface-2 ring-1 ring-line-strong"
                  />
                  <JobDetails openByDefault={!entry.collapsedByDefault} className="group/details">
                    <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center justify-between gap-x-6 gap-y-1 rounded-md py-1 [&::-webkit-details-marker]:hidden">
                      <h3 className="min-w-0 flex-1 text-h3">
                        {first?.title}
                        <span className="text-text-2"> · {entry.company}</span>
                      </h3>
                      <span className="inline-flex items-center gap-2">
                        <DateRange
                          locale={locale}
                          start={entry.roles.at(-1)?.start}
                          end={first?.end}
                          presentLabel={t('present')}
                        />
                        <ChevronDown
                          aria-hidden="true"
                          className="size-4 text-text-3 transition-transform group-open/details:rotate-180"
                        />
                      </span>
                      {entry.location ? (
                        <span className="w-full text-small text-text-3">{entry.location}</span>
                      ) : null}
                    </summary>
                    <div className="pb-4">{details}</div>
                  </JobDetails>
                </li>
              );
            })}
          </ol>
        </TimelineProgress>
      </div>
    ) : null;

  const educationPane =
    education.length > 0 ? (
      <div id="education">
        <ul className="grid gap-4 md:grid-cols-3">
          {education.map((item, index) => (
            <li key={item.id}>
              <Reveal
                index={index}
                className="card flex h-full flex-col rounded-lg border border-line bg-surface-1 p-5 shadow-(--shadow-card-inset)"
              >
                <p className="font-label text-text-3">{t(`kinds.${item.kind}`)}</p>
                <h3 className="mt-3 font-semibold text-text-1">{item.title}</h3>
                <p className="mt-1 text-small text-text-2">{item.institution}</p>
                <SkillChips
                  ids={item.skillIds}
                  names={names}
                  label={t('skills')}
                  className="mt-4"
                />
                <p className="mt-auto pt-4">
                  <DateRange locale={locale} start={item.start} end={item.end} />
                </p>
                {item.url ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t('viewCredentialLabel', {
                      title: item.title,
                    })}
                    className="mt-3 inline-flex min-h-11 items-center gap-1.5 self-start text-small text-text-1 underline-offset-4 hover-fine:underline"
                  >
                    {t('viewCredential')}
                    <ArrowUpRight aria-hidden="true" className="size-4" />
                  </a>
                ) : null}
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  return (
    <section id="resume" aria-labelledby="resume-title" className="section-y">
      <div className="container-page">
        <SectionHeader
          id="resume-title"
          index={4}
          eyebrow={t('eyebrow')}
          title={t('title')}
          lead={t('lead')}
        />

        <ResumePanes
          tablistLabel={t('tablist')}
          experienceLabel={t('experienceTab')}
          educationLabel={t('educationTab')}
          experience={experiencePane}
          education={educationPane}
        />

        {resumeLocales.length > 0 || linkedIn ? (
          <ul className="mt-10 flex flex-wrap gap-2 border-t border-line pt-8">
            {resumeLocales.map((fileLocale, index) => (
              <li key={fileLocale}>
                <a
                  href={`/${fileLocale}/resume`}
                  hrefLang={localeTags[fileLocale]}
                  className={linkClass}
                >
                  <FileText aria-hidden="true" className="size-4" />
                  {index === 0
                    ? t('download')
                    : t('downloadOther', {
                        language: tHeader(`languageNames.${fileLocale}`),
                      })}
                </a>
              </li>
            ))}
            {linkedIn ? (
              <li>
                <a
                  href={linkedIn.url}
                  target="_blank"
                  rel={externalRel(linkedIn.isOwnProfile)}
                  className={linkClass}
                >
                  <LinkIcon icon={linkedIn.icon} />
                  {linkedIn.label}
                  <ArrowUpRight aria-hidden="true" className="size-3.5 text-text-3" />
                  <span className="sr-only"> {tA11y('opensInNewTab')}</span>
                </a>
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
