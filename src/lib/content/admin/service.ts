import { type DocumentOf, documentSchemas, type DocumentType } from '../schema';
import { type FieldErrors, pruneEmpty, toFieldErrors } from './normalize';
import { type AdminDoc, type AdminStore, type Reference } from './types';

export const SINGLETONS = ['profile', 'contact', 'resume'] as const;
const singletons: readonly DocumentType[] = SINGLETONS;
const ORDER_STEP = 10;

/**
 * Side effects the service triggers; injected so tests stay pure.
 */
export interface AdminHooks {
  audit(event: { action: string; id: string; type: DocumentType }): void;
  now(): Date;
  revalidate(type: DocumentType, slugs: string[]): void;
}

export type SaveOutcome =
  | {
      doc: Record<string, unknown>;
      id: string;
      ok: true;
      rev: string;
      slug?: string;
    }
  | {
      fieldErrors: FieldErrors;
      formErrors: string[];
      kind: 'invalid';
      ok: false;
    }
  | { kind: 'conflict' | 'exists' | 'missing' | 'readonly'; ok: false };

export type DeleteOutcome =
  | { kind: 'conflict' | 'missing' | 'readonly' | 'singleton'; ok: false }
  | { kind: 'in-use'; ok: false; references: Reference[] }
  | { ok: true };

export type FlagOutcome =
  { kind: 'conflict' | 'missing' | 'readonly'; ok: false } | { ok: true; rev: string };

const META_KEYS = ['id', 'rev', 'updatedAt', 'isFixture', 'order'];

const invalid = (fieldErrors: FieldErrors, formErrors: string[] = []): SaveOutcome => ({
  ok: false,
  kind: 'invalid',
  fieldErrors,
  formErrors,
});

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const unique = <T>(values: T[]): T[] => [...new Set(values)];

export function createAdminService(
  store: AdminStore,
  hooks: AdminHooks,
): {
  readOnlyReason: null | string;
  remove(type: DocumentType, id: string, rev?: string): Promise<DeleteOutcome>;
  reorder(type: DocumentType, ids: string[]): Promise<FlagOutcome>;
  save(type: DocumentType, id: null | string, values: unknown, rev?: string): Promise<SaveOutcome>;
  setFlag(
    type: DocumentType,
    id: string,
    field: 'featured' | 'visible',
    value: boolean,
    rev?: string,
  ): Promise<FlagOutcome>;
} {
  const readonly = store.readOnlyReason !== null;

  async function nextOrder(type: DocumentType): Promise<number> {
    const docs = await store.list(type);
    const max = Math.max(0, ...docs.map((doc) => Number(doc['order'] ?? 0)));

    return max + ORDER_STEP;
  }

  /**
   * Without an icon source a skill is never in the cloud and keeps no stale
   * icon data.
   */
  function normalizeSkill(candidate: Record<string, unknown>): void {
    if (candidate['iconSource']) return;

    candidate['showInCloud'] = false;
    delete candidate['iconSlug'];
    delete candidate['customSvg'];
    delete candidate['monogram'];
  }

  /**
   * A slug change keeps the old one so its URL still redirects (§8.4).
   */
  function trackSlugs(candidate: Record<string, unknown>, existing: AdminDoc | null): void {
    const slug = candidate['slug'] as string | undefined;
    const previous = ((candidate['previousSlugs'] as string[] | undefined) ?? []).filter(
      (item) => item !== slug,
    );
    const old = existing?.['slug'] as string | undefined;

    candidate['previousSlugs'] = unique(old && old !== slug ? [...previous, old] : previous);
  }

  async function crossChecks(
    type: DocumentType,
    doc: Record<string, unknown>,
  ): Promise<FieldErrors> {
    const errors: FieldErrors = {};

    if (type === 'project') {
      const others = (await store.list('project')).filter((item) => item.id !== doc['id']);
      const slug = doc['slug'] as string;
      const taken = others.find(
        (item) =>
          item['slug'] === slug
          || ((item['previousSlugs'] as string[] | undefined) ?? []).includes(slug),
      );

      if (taken) errors['slug'] = 'Another project already uses this slug';

      const previous = (doc['previousSlugs'] as string[]).find((old) =>
        others.some((item) => item['slug'] === old),
      );

      if (previous) errors['previousSlugs'] = `"${previous}" is the slug of another project`;
    }

    if (type === 'project' || type === 'experience') {
      const known = new Set((await store.list('technology')).map((tech) => tech.id));

      (doc['techIds'] as string[]).forEach((techId, index) => {
        if (!known.has(techId)) errors[`techIds.${index}`] = 'Unknown technology';
      });
    }

    if (type === 'project') {
      const known = new Set((await store.list('skill')).map((skill) => skill.id));

      (doc['skillIds'] as string[]).forEach((skillId, index) => {
        if (!known.has(skillId)) errors[`skillIds.${index}`] = 'Unknown skill';
      });
    }

    return errors;
  }

  return {
    readOnlyReason: store.readOnlyReason,

    /**
     * Validates and writes one document. `id` is `null` for a new document;
     * `rev` is the revision the form loaded (optimistic concurrency).
     */
    async save(
      type: DocumentType,
      id: null | string,
      values: unknown,
      rev?: string,
    ): Promise<SaveOutcome> {
      if (readonly) return { ok: false, kind: 'readonly' };

      if (!isObject(values)) return invalid({}, ['Invalid form data']);

      const singleton = singletons.includes(type);
      const documentId = singleton ? type : (id ?? `${type}.${crypto.randomUUID()}`);
      const existing = await store.get(type, documentId);

      if (!singleton && id && !existing) return { ok: false, kind: 'missing' };

      if (!singleton && !id && existing) return { ok: false, kind: 'exists' };

      const clean = pruneEmpty(
        Object.fromEntries(Object.entries(values).filter(([key]) => !META_KEYS.includes(key))),
      ) as Record<string, unknown> | undefined;
      const candidate: Record<string, unknown> = {
        ...clean,
        id: documentId,
        updatedAt: hooks.now().toISOString(),
        ...(existing?.isFixture ? { isFixture: true } : {}),
      };

      if (type !== 'profile' && type !== 'contact' && type !== 'resume') {
        candidate['order'] = Number(existing?.['order'] ?? (await nextOrder(type)));
      }

      if (type === 'project') trackSlugs(candidate, existing);

      if (type === 'skill') normalizeSkill(candidate);

      const result = documentSchemas[type].safeParse(candidate);

      if (!result.success) {
        const { fieldErrors, formErrors } = toFieldErrors(result.error.issues);

        return invalid(fieldErrors, formErrors);
      }

      const parsed = result.data as Record<string, unknown>;
      const crossErrors = await crossChecks(type, parsed);

      if (Object.keys(crossErrors).length > 0) return invalid(crossErrors);

      const written = await store.write(type, parsed as DocumentOf<typeof type>, {
        isNew: !existing,
        expectedRev: existing ? rev : undefined,
      });

      if (!written.ok) return { ok: false, kind: written.reason };

      const slug = parsed['slug'] as string | undefined;
      const oldSlug = existing?.['slug'] as string | undefined;

      hooks.revalidate(type, unique([slug, oldSlug].filter(Boolean) as string[]));
      hooks.audit({
        type,
        id: documentId,
        action: existing ? 'update' : 'create',
      });

      return {
        ok: true,
        id: documentId,
        rev: written.rev,
        doc: { ...parsed, rev: written.rev },
        ...(slug ? { slug } : {}),
      };
    },

    async remove(type: DocumentType, id: string, rev?: string): Promise<DeleteOutcome> {
      if (readonly) return { ok: false, kind: 'readonly' };

      if (singletons.includes(type)) return { ok: false, kind: 'singleton' };

      const existing = await store.get(type, id);

      if (!existing) return { ok: false, kind: 'missing' };

      if (type === 'technology' || type === 'skill') {
        const references = await store.referencesTo(id);

        if (references.length > 0) return { ok: false, kind: 'in-use', references };
      }

      const result = await store.remove(type, id, rev);

      if (!result.ok)
        return {
          ok: false,
          kind: result.reason === 'exists' ? 'conflict' : result.reason,
        };

      hooks.revalidate(type, [existing['slug'] as string].filter(Boolean));
      hooks.audit({ type, id, action: 'delete' });

      return { ok: true };
    },

    /**
     * Visibility and featured toggles skip full validation on purpose.
     */
    async setFlag(
      type: DocumentType,
      id: string,
      field: 'featured' | 'visible',
      value: boolean,
      rev?: string,
    ): Promise<FlagOutcome> {
      if (readonly) return { ok: false, kind: 'readonly' };

      const existing = await store.get(type, id);

      if (!existing) return { ok: false, kind: 'missing' };

      const result = await store.patch(type, id, { [field]: value }, rev);

      if (!result.ok)
        return {
          ok: false,
          kind: result.reason === 'exists' ? 'conflict' : result.reason,
        };

      hooks.revalidate(type, [existing['slug'] as string].filter(Boolean));
      hooks.audit({ type, id, action: `${field}=${value}` });

      return { ok: true, rev: result.rev };
    },

    /**
     * Renumbers `order` (10, 20, …) to match `ids`; only changed rows are
     * written.
     */
    async reorder(type: DocumentType, ids: string[]): Promise<FlagOutcome> {
      if (readonly) return { ok: false, kind: 'readonly' };

      const docs = new Map((await store.list(type)).map((doc) => [doc.id, doc]));
      let last = '';
      for (const [index, id] of ids.entries()) {
        const doc = docs.get(id);

        if (!doc) return { ok: false, kind: 'missing' };

        const order = (index + 1) * ORDER_STEP;

        if (doc['order'] !== order) {
          const result = await store.patch(type, id, { order });

          if (!result.ok)
            return {
              ok: false,
              kind: result.reason === 'exists' ? 'conflict' : result.reason,
            };

          last = result.rev;
        }
      }
      hooks.revalidate(type, []);
      hooks.audit({ type, id: '*', action: 'reorder' });

      return { ok: true, rev: last };
    },
  };
}

export type AdminService = ReturnType<typeof createAdminService>;
