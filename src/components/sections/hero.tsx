import { ArrowRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { getImageProps } from 'next/image';
import { type CSSProperties } from 'react';

import { Monogram } from '@/components/layout/monogram';
import { HeroBackdrop } from '@/components/motion/hero-backdrop';
import { Magnetic } from '@/components/motion/magnetic';
import { ScrollCue } from '@/components/motion/scroll-cue';
import { ButtonAnchor } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { owner } from '@/config/site';
import { cn } from '@/lib/cn';
import { type Profile } from '@/lib/content';

import { FitTitle } from './fit-title';

const HERO_SIZES =
  '(min-width: 1440px) 504px, (min-width: 1280px) 448px, (min-width: 1024px) 360px, 144px';

interface HeroProps {
  nextSection: 'about' | 'stack';
  profile: null | Profile;
}

export async function Hero({ profile, nextSection }: HeroProps): Promise<React.JSX.Element> {
  const t = await getTranslations('hero');
  const jobTitle = profile?.jobTitle ?? owner.jobTitle;
  const photo = profile?.photo;
  const photoLg = profile?.photoLg ?? photo;

  return (
    <section
      id="top"
      aria-labelledby="hero-title"
      className="relative isolate flex min-h-[100svh] flex-col"
    >
      <HeroBackdrop />
      <div className="container-page grid flex-1 items-center gap-10 pt-[calc(var(--header-height)+3rem)] pb-24 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-10 xl:gap-12">
        <div className="lg:order-last">
          <Portrait photo={photo} photoLg={photoLg} role={t('eyebrow', { jobTitle })} />
        </div>
        <div className="@container min-w-0 max-lg:text-center">
          <p className="mb-3 font-label text-text-3 lg:hidden">{jobTitle}</p>
          <FitTitle
            id="hero-title"
            // A CSS variable from the layout: importing the font module here
            // would split its CSS into a second render-blocking stylesheet.
            fontFamily={profile?.titleFont && `var(--font-title-${profile.titleFont})`}
            className={cn(
              // Below lg the title takes the full width: lift the size cap.
              'max-lg:[--title-max:16rem]',
              profile?.titleFont ? 'font-normal [font-synthesis:none]' : 'font-semibold',
            )}
          >
            {profile?.displayName ?? owner.name}
          </FitTitle>

          {profile?.heroLead ? (
            <p className="mt-8 max-w-[60ch] text-[1.0625rem] max-lg:mx-auto text-text-2 lg:text-lg">
              {profile.heroLead}
            </p>
          ) : null}

          <div className="mt-9 flex flex-wrap items-center gap-3 max-lg:justify-center">
            <Magnetic>
              <ButtonAnchor href="#work">
                {t('seeWork')}
                <ArrowRight
                  aria-hidden="true"
                  className="transition-transform duration-200 group-hover/button:translate-x-0.5"
                />
              </ButtonAnchor>
            </Magnetic>
            <ButtonAnchor href="#contact" variant="secondary">
              {t('getInTouch')}
            </ButtonAnchor>
          </div>
        </div>
      </div>

      <div className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 md:block">
        <ScrollCue href={`#${nextSection}`} label={t('scrollCue')} />
      </div>
    </section>
  );
}

function RoleCallout({ title }: { title: string }): React.JSX.Element {
  return (
    <div className="pointer-events-none absolute top-[6%] left-[22%] z-[2] hidden lg:block">
      <span
        aria-hidden="true"
        className="absolute top-1/2 left-0 h-px w-28 origin-left -translate-y-1/2 rotate-[14deg] bg-gradient-to-r from-line-strong to-transparent"
      />
      <Chip className="absolute top-1/2 right-full -translate-y-1/2 whitespace-nowrap">
        {title}
      </Chip>
    </div>
  );
}

function Portrait({
  photo,
  photoLg,
  role,
}: {
  photo: Profile['photo'];
  photoLg: Profile['photoLg'];
  role: string;
}): React.JSX.Element {
  const frameClass = cn(
    'relative shrink-0',
    'size-36 overflow-hidden rounded-lg p-[2px] shadow-[0_20px_60px_-20px_rgb(139_124_255/0.55)] max-lg:bg-gradient-accent',
    'lg:aspect-[3/4] lg:h-auto lg:w-[clamp(18rem,min(35vw,calc((100svh-var(--header-height)-9rem)*0.75)),31.5rem)] lg:overflow-visible lg:rounded-none lg:p-0 lg:shadow-none',
  );

  if (!photo) {
    return (
      <div className={frameClass}>
        <div className="relative z-[1] flex size-full items-center justify-center rounded-[inherit] bg-surface-1 lg:bg-transparent">
          <Monogram className="size-1/2" />
        </div>
        <RoleCallout title={role} />
      </div>
    );
  }

  const desktop = photoLg ?? photo;
  const common = {
    alt: photo.alt,
    sizes: HERO_SIZES,
    priority: true,
  } as const;

  const {
    props: { srcSet: desktopSrcSet },
  } = getImageProps({
    ...common,
    src: desktop.url,
    width: desktop.width,
    height: desktop.height,
  });

  const {
    props: { srcSet: mobileSrcSet, ...img },
  } = getImageProps({
    ...common,
    src: photo.url,
    width: photo.width,
    height: photo.height,
  });

  const objectPosition = photo.focal
    ? `${photo.focal.x * 100}% ${photo.focal.y * 100}%`
    : undefined;

  return (
    <div className={frameClass}>
      <div
        className={cn(
          'relative size-full overflow-hidden rounded-[inherit] bg-surface-1',
          'max-lg:[background-image:var(--portrait-lqip)] max-lg:bg-cover max-lg:[background-position:var(--portrait-focal)]',
          'lg:overflow-visible lg:rounded-none lg:bg-transparent',
        )}
        style={
          photo.lqip
            ? ({
                '--portrait-lqip': `url(${photo.lqip})`,
                '--portrait-focal': objectPosition ?? 'center',
              } as CSSProperties)
            : undefined
        }
      >
        <picture>
          <source media="(min-width: 1024px)" srcSet={desktopSrcSet} sizes={HERO_SIZES} />
          <source media="(max-width: 1023px)" srcSet={mobileSrcSet} sizes={HERO_SIZES} />
          <img
            {...img}
            alt={photo.alt}
            className={cn(
              'relative z-[1] size-full object-cover max-lg:[object-position:var(--portrait-focal,center)]',
              'lg:object-contain lg:object-bottom',
              img.className,
            )}
            style={{
              ...img.style,
              width: '100%',
              height: '100%',
            }}
          />
        </picture>
        <RoleCallout title={role} />
      </div>
    </div>
  );
}
