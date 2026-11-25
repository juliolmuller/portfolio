import {
  type DocumentOf,
  type DocumentType,
  type FileAsset,
  type ImageAsset,
  type SKILL_LINK_CAPS,
} from '../schema';

/**
 * What the admin reads: the schema shape without validation, so a document that
 * fails it (a missing translation, say) can still be opened and fixed.
 */
export type AdminDoc = {
  id: string;
  isFixture?: boolean;
  rev?: string;
  updatedAt?: string;
} & Record<string, unknown>;

export type WriteResult =
  { ok: false; reason: 'conflict' | 'exists' | 'missing' } | { ok: true; rev: string };

export interface Reference {
  id: string;
  label: string;
  type: string;
}

export type SkillLinkOwner = keyof typeof SKILL_LINK_CAPS;

export interface SkillLinkChange {
  expectedRev: string;
  id: string;
  skillIds: string[];
  type: SkillLinkOwner;
}

export interface UploadMeta {
  contentType: string;
  filename: string;
}

export interface AdminStore {
  get(type: DocumentType, id: string): Promise<AdminDoc | null>;
  /**
   * The top-bar badge.
   */
  readonly label: string;
  /**
   * Every document of the type, hidden included, ordered.
   */
  list(type: DocumentType): Promise<AdminDoc[]>;

  /**
   * Small top-level changes (`visible`, `featured`, `order`) with no
   * revalidation of the rest.
   */
  patch(
    type: DocumentType,
    id: string,
    fields: Record<string, unknown>,
    expectedRev?: string,
  ): Promise<WriteResult>;
  /**
   * Why writes are off, or `null` when they work.
   */
  readonly readOnlyReason: null | string;

  /**
   * Documents that refer to `id` (technologies and skills in use).
   */
  referencesTo(id: string): Promise<Reference[]>;
  remove(type: DocumentType, id: string, expectedRev?: string): Promise<WriteResult>;
  /**
   * Replaces the `skillIds` of several owners. All or nothing: every revision
   * is checked before anything is written.
   */
  setSkillLinks(changes: SkillLinkChange[]): Promise<WriteResult>;
  readonly source: 'fixtures' | 'sanity';
  uploadFile(bytes: Buffer, meta: UploadMeta): Promise<FileAsset>;

  uploadImage(bytes: Buffer, meta: UploadMeta): Promise<ImageAsset>;
  write<T extends DocumentType>(
    type: T,
    document: DocumentOf<T>,
    options: { expectedRev?: string | undefined; isNew: boolean },
  ): Promise<WriteResult>;
}
