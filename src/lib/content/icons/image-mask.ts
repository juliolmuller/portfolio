import 'server-only';

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

import { type ImageAsset } from '../schema';

const SIDE = 256;

/**
 * The alpha channel of a stored raster logo as a grayscale PNG, for the
 * `/tech-icons` silhouette (D75). Sanity assets are read from its CDN on the
 * server (already resized there); fixture paths come from `public/`.
 */
export async function imageAlphaMask(
  asset: ImageAsset,
): Promise<{ base64Png: string; height: number; width: number } | null> {
  let bytes: Buffer;

  try {
    if (asset.url.startsWith('/fixtures/')) {
      bytes = await readFile(join(process.cwd(), 'public', asset.url));
    } else {
      const url = new URL(asset.url);

      url.searchParams.set('w', String(SIDE));
      url.searchParams.set('fm', 'png');

      const response = await fetch(url, { signal: AbortSignal.timeout(8000) });

      if (!response.ok) return null;

      bytes = Buffer.from(await response.arrayBuffer());
    }

    const { data, info } = await sharp(bytes, { limitInputPixels: 25_000_000 })
      .resize({ width: SIDE, height: SIDE, fit: 'inside', withoutEnlargement: true })
      .ensureAlpha()
      .extractChannel('alpha')
      .png()
      .toBuffer({ resolveWithObject: true });

    return { base64Png: data.toString('base64'), width: info.width, height: info.height };
  } catch {
    return null;
  }
}
