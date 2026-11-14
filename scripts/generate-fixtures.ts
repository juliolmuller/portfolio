/**
 * Renders the fictional placeholder images and sample resume PDFs into
 * `public/fixtures/` and writes their manifest. Deterministic: the same specs
 * always produce the same files. Run after changing `image-specs.ts`:
 *
 * Bun run fixtures:generate.
 */
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

import { owner } from '@/config/site';
import {
  type FixtureImageSpec,
  fixtureImageSpecs,
  fixturePdfKeys,
} from '@/lib/content/fixtures/image-specs';

const ROOT = path.resolve(import.meta.dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public', 'fixtures');
const MANIFEST = path.join(ROOT, 'src/lib/content/fixtures/assets.generated.ts');

const PALETTE = ['#8b7cff', '#4cc9f0', '#4ade80', '#fbbf24', '#f472b6'];

function random(seed: string): () => number {
  let state = Number.parseInt(createHash('sha256').update(seed).digest('hex').slice(0, 8), 16);

  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);

    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickColors(rand: () => number, count: number): string[] {
  const start = Math.floor(rand() * PALETTE.length);

  return Array.from(
    { length: count },
    (_, index) => PALETTE[(start + index * 2) % PALETTE.length] ?? '#8b7cff',
  );
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function coverSvg(spec: FixtureImageSpec, rand: () => number): string {
  const { width: w, height: h } = spec;
  const colors = pickColors(rand, 3);
  const blobs = colors
    .map((color, index) => {
      const cx = round(w * (0.15 + rand() * 0.7));
      const cy = round(h * (0.15 + rand() * 0.7));
      const r = round(Math.min(w, h) * (0.35 + rand() * 0.25));

      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" opacity="${0.55 - index * 0.1}"/>`;
    })
    .join('');
  const step = 40;
  const grid: string[] = [];
  for (let x = step; x < w; x += step) {
    grid.push(`<line x1="${x}" y1="0" x2="${x}" y2="${h}"/>`);
  }
  for (let y = step; y < h; y += step) {
    grid.push(`<line x1="0" y1="${y}" x2="${w}" y2="${y}"/>`);
  }
  const panels = Array.from({ length: 3 }, () => {
    const pw = Math.round(((0.18 + rand() * 0.22) * w) / step) * step;
    const ph = Math.round(((0.16 + rand() * 0.2) * h) / step) * step;
    const px = Math.round((rand() * (w - pw)) / step) * step;
    const py = Math.round((rand() * (h - ph)) / step) * step;

    return `<rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="18" fill="#11141b" fill-opacity="0.55" stroke="#ffffff" stroke-opacity="0.14"/>`;
  }).join('');
  const orbit = `<circle cx="${round(w * (0.3 + rand() * 0.4))}" cy="${round(h * (0.3 + rand() * 0.4))}" r="${round(h * 0.36)}" fill="none" stroke="#ffffff" stroke-opacity="0.12" stroke-width="2"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs><filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${round(Math.min(w, h) * 0.12)}"/></filter></defs>
<rect width="${w}" height="${h}" fill="#0c0e13"/>
<g filter="url(#b)">${blobs}</g>
<g stroke="#ffffff" stroke-opacity="0.06" stroke-width="1">${grid.join('')}</g>
${orbit}${panels}
</svg>`;
}

function roundSvg(spec: FixtureImageSpec, rand: () => number): string {
  const { width: w, height: h } = spec;
  const [a = '#8b7cff', b = '#4cc9f0'] = pickColors(rand, 2);
  const angle = Math.round(rand() * 360);
  const rings = Array.from({ length: 4 }, (_, index) => {
    const r = round((w / 2) * (0.35 + index * 0.17));

    return `<circle cx="${w / 2}" cy="${h / 2}" r="${r}" fill="none" stroke="#ffffff" stroke-opacity="${0.18 - index * 0.035}" stroke-width="${round(w / 128)}"/>`;
  }).join('');
  const glow = `<circle cx="${round(w * (0.3 + rand() * 0.4))}" cy="${round(h * (0.3 + rand() * 0.4))}" r="${round(w * 0.32)}" fill="${a}" opacity="0.7"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs>
<linearGradient id="g" gradientTransform="rotate(${angle} 0.5 0.5)"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>
<filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${round(w * 0.1)}"/></filter>
</defs>
<rect width="${w}" height="${h}" fill="#11141b"/>
<rect width="${w}" height="${h}" fill="url(#g)" opacity="0.45"/>
<g filter="url(#b)">${glow}</g>
${rings}
</svg>`;
}

async function encodeAuthored(spec: FixtureImageSpec): Promise<{
  asset: { height: number; lqip: string; url: string; width: number };
  bytes: number;
  key: string;
}> {
  const authored = spec.authored;

  if (!authored) {
    throw new Error(`Fixture "${spec.key}" has no authored source`);
  }

  const sourcePath = path.join(PUBLIC_DIR, 'images', authored.source);
  const resized = sharp(sourcePath).resize(spec.width, spec.height, {
    fit: authored.fit,
    position: 'centre',
    withoutEnlargement: true,
  });
  const webp = authored.alpha
    ? await resized.webp({ quality: 82, alphaQuality: 90, effort: 6 }).toBuffer()
    : await resized.webp({ quality: 82, effort: 6, smartSubsample: true }).toBuffer();
  const meta = await sharp(webp).metadata();
  const lqip = await sharp(webp)
    .flatten({ background: '#11141b' })
    .resize(20)
    .jpeg({ quality: 50 })
    .toBuffer();
  const file = `images/${spec.key}.webp`;

  await writeFile(path.join(PUBLIC_DIR, file), webp);

  return {
    key: spec.key,
    asset: {
      url: `/fixtures/${file}`,
      width: meta.width ?? spec.width,
      height: meta.height ?? spec.height,
      lqip: `data:image/jpeg;base64,${lqip.toString('base64')}`,
    },
    bytes: webp.length,
  };
}

async function renderImage(spec: FixtureImageSpec): Promise<{
  asset: { height: number; lqip: string; url: string; width: number };
  bytes: number;
  key: string;
}> {
  if (spec.authored) return encodeAuthored(spec);

  const rand = random(spec.key);
  const svg = spec.style === 'cover' ? coverSvg(spec, rand) : roundSvg(spec, rand);
  const image = sharp(Buffer.from(svg));
  const webp = await image
    .clone()
    .webp({ quality: 82, effort: 6, smartSubsample: true })
    .toBuffer();
  const lqip = await image.clone().resize(20).jpeg({ quality: 50 }).toBuffer();
  const file = `images/${spec.key}.webp`;

  await writeFile(path.join(PUBLIC_DIR, file), webp);

  return {
    key: spec.key,
    asset: {
      url: `/fixtures/${file}`,
      width: spec.width,
      height: spec.height,
      lqip: `data:image/jpeg;base64,${lqip.toString('base64')}`,
    },
    bytes: webp.length,
  };
}

// --- PDF ---------------------------------------------------------------------

const WIN_ANSI: Record<string, number> = {
  '—': 0x97,
  '–': 0x96,
  '’': 0x92,
  '‘': 0x91,
  '“': 0x93,
  '”': 0x94,
  '•': 0x95,
  '…': 0x85,
};

function pdfString(value: string): string {
  let out = '';
  for (const char of value) {
    const code = WIN_ANSI[char] ?? char.codePointAt(0) ?? 0x3f;

    if (code > 0xff) throw new Error(`Unsupported PDF character: ${char}`);

    if (char === '\\' || char === '(' || char === ')') out += `\\${char}`;
    else if (code < 0x20 || code > 0x7e) {
      out += `\\${code.toString(8).padStart(3, '0')}`;
    } else out += char;
  }

  return `(${out})`;
}

interface PdfLine {
  bold?: boolean;
  gap?: number;
  size: number;
  text: string;
}

const RESUME_LINES: Record<'en' | 'pt', { lines: PdfLine[]; title: string }> = {
  en: {
    title: 'Sample resume (fictional)',
    lines: [
      { text: 'Sample resume (fictional)', size: 22, bold: true },
      {
        text: `${owner.name} — ${owner.jobTitle} — ${owner.city}, ${owner.country}`,
        size: 11,
        gap: 22,
      },
      {
        text: 'Placeholder document for development. Every company, metric and project below is invented.',
        size: 9,
        gap: 18,
      },
      { text: 'Experience', size: 13, bold: true, gap: 30 },
      {
        text: 'Lumen Works — Senior Full Stack Engineer (2023 – present)',
        size: 10,
        gap: 18,
      },
      {
        text: 'Northbridge Labs — Lead Frontend Engineer (2020 – 2023)',
        size: 10,
        gap: 15,
      },
      {
        text: 'Fable & Co. — Software Engineer (2016 – 2020)',
        size: 10,
        gap: 15,
      },
      { text: 'Education', size: 13, bold: true, gap: 28 },
      {
        text: 'B.Sc. in Computer Science — Example University (2012 – 2016)',
        size: 10,
        gap: 18,
      },
    ],
  },
  pt: {
    title: 'Currículo de exemplo (fictício)',
    lines: [
      { text: 'Currículo de exemplo (fictício)', size: 22, bold: true },
      {
        text: `${owner.name} — Engenheiro de Software Full Stack Sênior — ${owner.city}, Brasil`,
        size: 11,
        gap: 22,
      },
      {
        text: 'Documento provisório para desenvolvimento. Todas as empresas, métricas e projetos abaixo são inventados.',
        size: 9,
        gap: 18,
      },
      { text: 'Experiência', size: 13, bold: true, gap: 30 },
      {
        text: 'Lumen Works — Engenheiro Full Stack Sênior (2023 – atual)',
        size: 10,
        gap: 18,
      },
      {
        text: 'Northbridge Labs — Líder de Frontend (2020 – 2023)',
        size: 10,
        gap: 15,
      },
      {
        text: 'Fable & Co. — Engenheiro de Software (2016 – 2020)',
        size: 10,
        gap: 15,
      },
      { text: 'Formação', size: 13, bold: true, gap: 28 },
      {
        text: 'Bacharelado em Ciência da Computação — Example University (2012 – 2016)',
        size: 10,
        gap: 18,
      },
    ],
  },
};

function buildPdf(locale: 'en' | 'pt'): Buffer {
  const { title, lines } = RESUME_LINES[locale];
  let y = 780;
  const content = lines
    .map((line) => {
      y -= line.gap ?? 0;

      return `BT /${line.bold ? 'F2' : 'F1'} ${line.size} Tf 56 ${y} Td ${pdfString(line.text)} Tj ET`;
    })
    .join('\n');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    `<< /Title ${pdfString(title)} /Producer (juliolmuller.com fixtures) >>`,
  ];

  let body = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
  const offsets: number[] = [];

  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body, 'latin1'));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xref = Buffer.byteLength(body, 'latin1');
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 7 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

  return Buffer.from(body, 'latin1');
}

// --- Main --------------------------------------------------------------------

async function main(): Promise<void> {
  await mkdir(path.join(PUBLIC_DIR, 'images'), { recursive: true });
  await mkdir(path.join(PUBLIC_DIR, 'pdf'), { recursive: true });

  const images = await Promise.all(fixtureImageSpecs.map(renderImage));
  const files = await Promise.all(
    fixturePdfKeys.map(async (key) => {
      const locale = key === 'resume-pt' ? 'pt' : 'en';
      const pdf = buildPdf(locale);
      const file = `pdf/${key}.pdf`;

      await writeFile(path.join(PUBLIC_DIR, file), pdf);

      return {
        key,
        asset: {
          url: `/fixtures/${file}`,
          size: pdf.length,
          mimeType: 'application/pdf' as const,
        },
      };
    }),
  );

  const manifest = `// Generated by scripts/generate-fixtures.ts. Do not edit.
import type { FileAsset, ImageAsset } from '../schema';
import type { FixtureImageKey, FixturePdfKey } from './image-specs';

export const fixtureImageAssets: Record<FixtureImageKey, ImageAsset> = ${JSON.stringify(
    Object.fromEntries(images.map((image) => [image.key, image.asset])),
    null,
    2,
  )};

export const fixtureFileAssets: Record<FixturePdfKey, FileAsset> = ${JSON.stringify(
    Object.fromEntries(files.map((file) => [file.key, file.asset])),
    null,
    2,
  )};
`;

  await writeFile(MANIFEST, manifest);

  const total = images.reduce((sum, image) => sum + image.bytes, 0);

  console.info(
    `Generated ${images.length} images (${Math.round(total / 1024)} KB) and ${files.length} PDFs.`,
  );
}

await main();
