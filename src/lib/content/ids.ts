import { createHash } from 'node:crypto';

import { type DocumentType } from './schema';

/**
 * The id types `derivedId` accepts. `'skill'` joins `DocumentType` here until
 * #56 registers it in `documentSchemas`; then this collapses to
 * `DocumentType`.
 */
export type DerivedIdType = 'skill' | DocumentType;

/**
 * Stable `<type>.<uuid>` id derived from a key (v5-style UUID layout over
 * sha1("<type>:<key>")). Fixtures and skill copies use it (D28, D93).
 */
export function derivedId(type: DerivedIdType, key: string): string {
  const hex = createHash('sha1').update(`${type}:${key}`).digest('hex');
  const variant = ((Number.parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80)
    .toString(16)
    .padStart(2, '0');
  const uuid = [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    `${variant}${hex.slice(18, 20)}`,
    hex.slice(20, 32),
  ].join('-');

  return `${type}.${uuid}`;
}
