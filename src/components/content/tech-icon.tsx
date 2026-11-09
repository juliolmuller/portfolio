import { type CSSProperties } from 'react';

import { cn } from '@/lib/cn';
import { type TechIcon as TechIconData } from '@/lib/content';
import { type PublicTechIcon, toPublicIcon } from '@/lib/content/icon-src';

/**
 * Logo in `currentColor` or a monogram badge. A `src` icon is a cached file
 * drawn as a mask (D59); inline paths are kept for the few icons elsewhere.
 */
export function TechIcon({
  icon,
  className,
}: {
  className?: string;
  icon: PublicTechIcon | TechIconData;
}): React.JSX.Element {
  if ('monogram' in icon) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          'inline-flex size-5 shrink-0 items-center justify-center rounded-[5px] border border-current font-mono text-[0.5625rem] leading-none font-semibold',
          className,
        )}
      >
        {icon.monogram}
      </span>
    );
  }

  // A raster logo only exists as the served silhouette file (D75).
  const file = 'image' in icon ? toPublicIcon(icon) : icon;

  if ('src' in file) {
    const mask = `url("${file.src}") center / contain no-repeat`;

    return (
      <span
        aria-hidden="true"
        className={cn(
          'inline-block size-5 shrink-0 bg-current forced-color-adjust-none forced-colors:bg-[CanvasText]',
          className,
        )}
        style={{ mask, WebkitMask: mask } as CSSProperties}
      />
    );
  }

  if ('monogram' in file) return <TechIcon icon={file} className={className} />;

  return (
    <svg
      viewBox={file.viewBox}
      aria-hidden="true"
      focusable="false"
      fill="currentColor"
      className={cn('size-5 shrink-0', className)}
    >
      {file.paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
