import { type SanityClient } from '@sanity/client';

import { stripNulls } from '../pipeline';
import { type AssetResolver, skillReferences, toSanityDocument } from '../sanity/documents';
import { adminGetQuery, adminListQuery } from '../sanity/queries';
import { type FileAsset, type ImageAsset } from '../schema';
import { type AdminDoc, type AdminStore, type Reference, type WriteResult } from './types';

/**
 * `…/images/<project>/<dataset>/<hash>-<w>x<h>.<ext>` →
 * `image-<hash>-<w>x<h>-<ext>`.
 */
export function imageAssetId(url: string): string {
  const match = /\/images\/[^/]+\/[^/]+\/([a-f0-9]+-\d+x\d+)\.([a-z0-9]+)$/.exec(url);

  if (!match) throw new Error('Not a Sanity image URL');

  return `image-${match[1]}-${match[2]}`;
}

/**
 * `…/files/<project>/<dataset>/<hash>.<ext>` → `file-<hash>-<ext>`.
 */
export function fileAssetId(url: string): string {
  const match = /\/files\/[^/]+\/[^/]+\/([a-f0-9]+)\.([a-z0-9]+)$/.exec(url);

  if (!match) throw new Error('Not a Sanity file URL');

  return `file-${match[1]}-${match[2]}`;
}

const resolver: AssetResolver = {
  image: (asset) => imageAssetId(asset.url),
  file: (asset) => fileAssetId(asset.url),
};

function statusOf(error: unknown): number | undefined {
  return typeof error === 'object' && error !== null && 'statusCode' in error
    ? (error as { statusCode: number }).statusCode
    : undefined;
}

/**
 * 409 is Sanity's answer to a stale `ifRevisionID` or an existing id.
 */
async function attempt(
  action: () => Promise<{ _rev?: string } | undefined>,
  onConflict: 'conflict' | 'exists' = 'conflict',
): Promise<WriteResult> {
  try {
    const result = await action();

    return { ok: true, rev: result?._rev ?? '' };
  } catch (error) {
    const status = statusOf(error);

    if (status === 409) return { ok: false, reason: onConflict };

    if (status === 404) return { ok: false, reason: 'missing' };

    throw error;
  }
}

export function createSanityAdminStore(
  client: SanityClient,
  options: { dataset: string; readOnlyReason?: string },
): AdminStore {
  return {
    source: 'sanity',
    readOnlyReason: options.readOnlyReason ?? null,
    label: `Sanity · ${options.dataset}`,

    async list(type): Promise<AdminDoc[]> {
      const rows = await client.fetch<unknown[]>(adminListQuery(type));

      return rows.map((row) => stripNulls(row) as AdminDoc);
    },

    async get(type, id): Promise<AdminDoc | null> {
      const row = await client.fetch<unknown>(adminGetQuery(type), { id });

      return row ? (stripNulls(row) as AdminDoc) : null;
    },

    async write(type, document, { isNew, expectedRev }): Promise<WriteResult> {
      const stored = toSanityDocument(type, document as never, resolver);

      if (isNew) {
        return attempt(() => client.create(stored), 'exists');
      }

      const current = await client.getDocument(document.id);

      if (!current) return { ok: false, reason: 'missing' };

      const { _id, _type, ...fields } = stored;
      const unset = Object.keys(current).filter((key) => !key.startsWith('_') && !(key in fields));
      const patch = client.patch(document.id);

      if (expectedRev) patch.ifRevisionId(expectedRev);

      return attempt(() => patch.set(fields).unset(unset).commit());
    },

    async patch(_type, id, fields, expectedRev): Promise<WriteResult> {
      const patch = client.patch(id);

      if (expectedRev) patch.ifRevisionId(expectedRev);

      return attempt(() => patch.set(fields).commit());
    },

    async remove(_type, id, expectedRev): Promise<WriteResult> {
      const transaction = client.transaction();

      // A no-op patch carries the revision check into the same transaction.
      if (expectedRev) {
        transaction.patch(id, {
          ifRevisionID: expectedRev,
          unset: ['deletedMarker'],
        });
      }

      transaction.delete(id);

      return attempt(async () => {
        const result = await transaction.commit();

        return { _rev: result.transactionId };
      });
    },

    async setSkillLinks(changes): Promise<WriteResult> {
      if (changes.length === 0) return { ok: true, rev: '' };

      const transaction = client.transaction();

      for (const change of changes) {
        transaction.patch(change.id, {
          ifRevisionID: change.expectedRev,
          set: { skills: skillReferences(change.id, change.skillIds) },
        });
      }

      return attempt(async () => {
        const result = await transaction.commit();

        return { _rev: result.transactionId };
      });
    },

    async referencesTo(id): Promise<Reference[]> {
      return client.fetch<Reference[]>(
        `*[references($id)]{ "id": _id, "type": _type, "label": coalesce(title.en, company, _id) }`,
        { id },
      );
    },

    async uploadImage(bytes, meta): Promise<ImageAsset> {
      const asset = await client.assets.upload('image', bytes, {
        filename: meta.filename,
        contentType: meta.contentType,
        extract: ['lqip'],
      });
      const dimensions = asset.metadata.dimensions;

      return {
        url: asset.url,
        width: dimensions.width,
        height: dimensions.height,
        ...(asset.metadata.lqip ? { lqip: asset.metadata.lqip } : {}),
      };
    },

    async uploadFile(bytes, meta): Promise<FileAsset> {
      const asset = await client.assets.upload('file', bytes, {
        filename: meta.filename,
        contentType: meta.contentType,
      });

      return { url: asset.url, size: asset.size, mimeType: 'application/pdf' };
    },
  };
}
