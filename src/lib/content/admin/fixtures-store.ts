import sharp from 'sharp';

import { type FixtureDataset } from '../fixtures/dataset';
import { stripNulls } from '../pipeline';
import { type DocumentType } from '../schema';
import { type AdminDoc, type AdminStore, type Reference, type WriteResult } from './types';

/**
 * Stand-in for uploaded pixels: fixtures have no asset store (D53).
 */
const PLACEHOLDER_IMAGE = '/fixtures/images/profile-photo.webp';
const PLACEHOLDER_FILE = '/fixtures/pdf/resume-en.pdf';

type Stored = AdminDoc;

const INITIAL_REV = 'initial';
const nextRev = (): string => crypto.randomUUID().slice(0, 8);

/**
 * Same order as the Sanity admin query (`order asc, _id asc`), so a reorder
 * survives a reload. Documents without `order` keep a stable id order.
 */
function byOrder(a: Stored, b: Stored): number {
  const delta = Number(a['order'] ?? 0) - Number(b['order'] ?? 0);

  return delta === 0 ? a.id.localeCompare(b.id) : delta;
}

function labelOf(doc: Stored): string {
  const title = doc['title'] as { en?: string } | undefined;

  return title?.en ?? (doc['company'] as string | undefined) ?? doc.id;
}

/**
 * Writable in-memory store over the same dataset the public fixtures source
 * reads, so an edit shows up on the site right after revalidation. Writes
 * vanish on restart.
 */
export function createFixturesAdminStore(
  dataset: FixtureDataset,
  options: { readOnlyReason: string; writable: boolean },
): AdminStore {
  const collection = (type: DocumentType): AdminDoc[] => dataset[type] as unknown as Stored[];

  const find = (type: DocumentType, id: string): AdminDoc | undefined =>
    collection(type).find((doc) => doc.id === id);

  const revOf = (doc: Stored): string => doc.rev ?? INITIAL_REV;

  function check(doc: Stored | undefined, expectedRev?: string): null | WriteResult {
    if (!doc) return { ok: false, reason: 'missing' };

    if (expectedRev && expectedRev !== revOf(doc)) {
      return { ok: false, reason: 'conflict' };
    }

    return null;
  }

  function stamp(doc: Stored, touch = true): string {
    doc.rev = nextRev();

    if (touch) doc.updatedAt = new Date().toISOString();

    return doc.rev;
  }

  return {
    source: 'fixtures',
    readOnlyReason: options.writable ? null : options.readOnlyReason,
    label: options.writable ? 'Demo data' : 'Demo data, read-only',

    async list(
      type,
    ): Promise<Array<{ id: string; isFixture?: boolean; rev: string; updatedAt?: string }>> {
      return structuredClone(collection(type))
        .map((doc) => ({ ...(stripNulls(doc) as Stored), rev: revOf(doc) }))
        .sort(byOrder);
    },

    async get(
      type,
      id,
    ): Promise<{ id: string; isFixture?: boolean; rev: string; updatedAt?: string } | null> {
      const doc = find(type, id);

      return doc ? { ...(stripNulls(structuredClone(doc)) as Stored), rev: revOf(doc) } : null;
    },

    async write(type, document, { isNew, expectedRev }): Promise<WriteResult> {
      const list = collection(type);
      const existing = find(type, document.id);

      if (isNew && existing) return { ok: false, reason: 'exists' };

      if (!isNew) {
        const problem = check(existing, expectedRev);

        if (problem) return problem;
      }

      const next = structuredClone(document) as unknown as Stored;
      const rev = stamp(next, false);

      if (existing) list[list.indexOf(existing)] = next;
      else list.push(next);

      return { ok: true, rev };
    },

    async patch(type, id, fields, expectedRev): Promise<WriteResult> {
      const doc = find(type, id);
      const problem = check(doc, expectedRev);

      if (problem || !doc) return problem ?? { ok: false, reason: 'missing' };

      Object.assign(doc, structuredClone(fields));

      return { ok: true, rev: stamp(doc) };
    },

    async remove(type, id, expectedRev): Promise<WriteResult> {
      const doc = find(type, id);
      const problem = check(doc, expectedRev);

      if (problem || !doc) return problem ?? { ok: false, reason: 'missing' };

      collection(type).splice(collection(type).indexOf(doc), 1);

      return { ok: true, rev: INITIAL_REV };
    },

    async referencesTo(id): Promise<Reference[]> {
      const found: Reference[] = [];
      for (const type of ['project', 'experience'] as const) {
        for (const doc of collection(type)) {
          if (((doc['techIds'] as string[] | undefined) ?? []).includes(id)) {
            found.push({ type, id: doc.id, label: labelOf(doc) });
          }
        }
      }

      return found;
    },

    async uploadImage(bytes): Promise<{ height: number; url: string; width: number }> {
      const { width, height } = await sharp(bytes).metadata();

      return { url: PLACEHOLDER_IMAGE, width: width ?? 1, height: height ?? 1 };
    },

    async uploadFile(bytes): Promise<{ mimeType: 'application/pdf'; size: number; url: string }> {
      return {
        url: PLACEHOLDER_FILE,
        size: bytes.length,
        mimeType: 'application/pdf',
      };
    },
  };
}
