/**
 * Resolves the icon of every seeded technology and fails when one configured to
 * come from an icon package falls back to a monogram (§2, D13). Writes a
 * contact sheet to `.cache/icons-audit.{html,png}` for visual review.
 *
 * Bun run icons:audit.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

import { createFixtureDataset } from '@/lib/content/fixtures/dataset';
import { resolveTechIcon } from '@/lib/content/icons/resolve';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT_DIR = path.join(ROOT, '.cache');
const NEUTRAL = '#a3a9b8';

const escapeXml = (value: string): string =>
  value.replace(/[<>&"]/g, (char) => `&#${char.charCodeAt(0)};`);

async function main(): Promise<void> {
  const technologies = createFixtureDataset().technology;
  const rows = await Promise.all(
    technologies.map(async (tech) => ({
      tech,
      resolved: await resolveTechIcon(tech),
    })),
  );

  const failures = rows.filter(
    ({ tech, resolved }) => tech.iconSource !== 'monogram' && resolved.source === 'monogram',
  );

  const width = 8;
  const cell = 150;
  const height = Math.ceil(rows.length / width);
  const tiles = rows.map(({ tech, resolved }, index) => {
    const x = (index % width) * cell;
    const y = Math.floor(index / width) * cell;
    const color = tech.brandColor ?? resolved.defaultBrandColor ?? NEUTRAL;
    const icon = resolved.icon;
    const glyph =
      'image' in icon
        ? (offset: number, fill: string): string =>
            `<g><rect x="${x + offset}" y="${y + 24}" width="48" height="48" rx="10" fill="none" stroke="${fill}" stroke-dasharray="4 3" stroke-width="2"/><text x="${x + offset + 24}" y="${y + 54}" font-family="sans-serif" font-size="11" text-anchor="middle" fill="${fill}">image</text></g>`
        : 'paths' in icon
          ? (offset: number, fill: string): string =>
              `<svg x="${x + offset}" y="${y + 24}" width="48" height="48" viewBox="${icon.viewBox}">${icon.paths
                .map((d) => `<path d="${d}" fill="${fill}"/>`)
                .join('')}</svg>`
          : (offset: number, fill: string): string =>
              `<g><rect x="${x + offset}" y="${y + 24}" width="48" height="48" rx="10" fill="none" stroke="${fill}" stroke-width="2"/><text x="${x + offset + 24}" y="${y + 54}" font-family="sans-serif" font-size="15" font-weight="700" text-anchor="middle" fill="${fill}">${escapeXml(icon.monogram)}</text></g>`;

    return `${glyph(18, NEUTRAL)}${glyph(84, color)}<text x="${x + cell / 2}" y="${y + 100}" font-family="sans-serif" font-size="13" text-anchor="middle" fill="#e8eaf0">${escapeXml(tech.name)}</text><text x="${x + cell / 2}" y="${y + 118}" font-family="sans-serif" font-size="11" text-anchor="middle" fill="#828a9f">${resolved.source}</text>`;
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width * cell}" height="${height * cell}"><rect width="100%" height="100%" fill="#07080b"/>${tiles.join('')}</svg>`;

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(
    path.join(OUT_DIR, 'icons-audit.html'),
    `<!doctype html><meta charset="utf-8"><title>Icons audit</title><body style="margin:0;background:#07080b">${svg}</body>`,
  );
  await sharp(Buffer.from(svg)).png().toFile(path.join(OUT_DIR, 'icons-audit.png'));

  const bySource = new Map<string, number>();
  for (const { resolved } of rows) {
    bySource.set(resolved.source, (bySource.get(resolved.source) ?? 0) + 1);
  }
  console.info(
    `Resolved ${rows.length} technologies: ${[...bySource]
      .map(([source, count]) => `${source} ${count}`)
      .join(', ')}.`,
  );
  console.info('Contact sheet: .cache/icons-audit.html (and .png)');

  if (failures.length > 0) {
    for (const { tech } of failures) {
      console.error(`✗ ${tech.name}: ${tech.iconSource} "${tech.iconSlug ?? ''}" not found`);
    }
    process.exit(1);
  }
}

await main();
