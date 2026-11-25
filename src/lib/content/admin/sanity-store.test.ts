import { type SanityClient } from '@sanity/client';
import { describe, expect, it, vi } from 'vitest';

import { createFixtureDataset } from '../fixtures/dataset';
import { type DocumentOf } from '../schema';
import { createSanityAdminStore, fileAssetId, imageAssetId } from './sanity-store';

describe('asset ids', () => {
  it('derive from CDN URLs and refuse anything else', () => {
    expect(imageAssetId('https://cdn.sanity.io/images/p/d/abc123def-800x600.webp')).toBe(
      'image-abc123def-800x600-webp',
    );
    expect(fileAssetId('https://cdn.sanity.io/files/p/d/0f9e8d.pdf')).toBe('file-0f9e8d-pdf');
    expect(() => imageAssetId('/fixtures/images/a.webp')).toThrow();
    expect(() => fileAssetId('https://example.com/x.pdf')).toThrow();
  });
});

function fakeClient(
  options: { current?: null | Record<string, unknown>; failWith?: number } = {},
): { calls: unknown[][]; client: SanityClient } {
  const calls: unknown[][] = [];
  const fail = (): Promise<{ _rev: string }> =>
    options.failWith
      ? Promise.reject(Object.assign(new Error('x'), { statusCode: options.failWith }))
      : Promise.resolve({ _rev: 'r2' });
  const builder = {
    ifRevisionId: vi.fn((rev: string) => (calls.push(['ifRevisionId', rev]), builder)),
    set: vi.fn(
      (fields: Record<string, unknown>) => (
        calls.push(['set', Object.keys(fields)], ['setValues', fields]),
        builder
      ),
    ),
    unset: vi.fn((keys: string[]) => (calls.push(['unset', keys]), builder)),
    commit: vi.fn(fail),
  };
  const client = {
    patch: vi.fn(() => builder),
    create: vi.fn(fail),
    getDocument: vi.fn(async () => options.current ?? null),
    transaction: vi.fn(() => {
      const transaction = {
        patch: vi.fn((...args: unknown[]) => (calls.push(['tx.patch', args]), transaction)),
        delete: vi.fn((id: string) => (calls.push(['tx.delete', id]), transaction)),
        commit: vi.fn(async () => (options.failWith ? fail() : { transactionId: 't1' })),
      };

      return transaction;
    }),
  };

  return { client: client as unknown as SanityClient, calls };
}

const link = createFixtureDataset().featuredLink[0] as unknown as DocumentOf<'featuredLink'>;

describe('sanity admin store writes', () => {
  it('patches an existing document with the loaded revision and unsets dropped fields', async () => {
    const { client, calls } = fakeClient({
      current: { _id: link.id, _rev: 'r1', staleField: 1, label: {} },
    });
    const store = createSanityAdminStore(client, { dataset: 'development' });
    const result = await store.write('featuredLink', link, {
      isNew: false,
      expectedRev: 'r1',
    });

    expect(result).toEqual({ ok: true, rev: 'r2' });
    expect(calls).toContainEqual(['ifRevisionId', 'r1']);
    expect(calls).toContainEqual(['unset', ['staleField']]);
  });

  it('writes project skill ids as references and keeps the field set', async () => {
    // Fixture images are local files; only Sanity CDN assets can be referenced.
    const project = {
      ...createFixtureDataset().project[0],
      cover: undefined,
      gallery: [],
    } as unknown as DocumentOf<'project'>;
    const { client, calls } = fakeClient({
      current: { _id: project.id, _rev: 'r1', skills: [] },
    });
    const store = createSanityAdminStore(client, { dataset: 'development' });
    const result = await store.write('project', project, { isNew: false, expectedRev: 'r1' });
    const values = calls.find((call) => call[0] === 'setValues')?.[1] as Record<string, unknown>;
    const skills = values['skills'] as Array<{ _ref: string; _type: string }>;

    expect(result).toEqual({ ok: true, rev: 'r2' });
    expect(project.skillIds.length).toBeGreaterThan(0);
    expect(skills.map((reference) => reference._type)).toEqual(
      project.skillIds.map(() => 'reference'),
    );
    expect(skills.map((reference) => reference._ref)).toEqual(project.skillIds);
    expect(
      calls.filter((call) => call[0] === 'unset').flatMap((call) => call[1] as string[]),
    ).not.toContain('skills');
  });

  it('maps a 409 to a conflict, or to "exists" when creating', async () => {
    const stale = fakeClient({ failWith: 409, current: { _id: link.id } });

    expect(
      await createSanityAdminStore(stale.client, { dataset: 'd' }).write('featuredLink', link, {
        isNew: false,
        expectedRev: 'old',
      }),
    ).toEqual({ ok: false, reason: 'conflict' });

    const taken = fakeClient({ failWith: 409 });

    expect(
      await createSanityAdminStore(taken.client, { dataset: 'd' }).write('featuredLink', link, {
        isNew: true,
      }),
    ).toEqual({ ok: false, reason: 'exists' });
  });

  it('reports a document that vanished', async () => {
    const { client } = fakeClient({ current: null });

    expect(
      await createSanityAdminStore(client, { dataset: 'd' }).write('featuredLink', link, {
        isNew: false,
        expectedRev: 'r1',
      }),
    ).toEqual({ ok: false, reason: 'missing' });
  });

  it('deletes inside one transaction that also checks the revision', async () => {
    const { client, calls } = fakeClient();
    const result = await createSanityAdminStore(client, {
      dataset: 'd',
    }).remove('featuredLink', 'featuredLink.1', 'r9');

    expect(result.ok).toBe(true);
    expect(calls[0]).toEqual([
      'tx.patch',
      ['featuredLink.1', { ifRevisionID: 'r9', unset: ['deletedMarker'] }],
    ]);
    expect(calls[1]).toEqual(['tx.delete', 'featuredLink.1']);
  });

  it('carries the read-only reason and the badge label', () => {
    const { client } = fakeClient();
    const store = createSanityAdminStore(client, {
      dataset: 'development',
      readOnlyReason: 'no token',
    });

    expect(store.readOnlyReason).toBe('no token');
    expect(store.label).toBe('Sanity · development');
  });
});
