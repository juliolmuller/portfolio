import { derivedId } from '../ids';
import { type DocumentType } from '../schema';

/**
 * Stable `<type>.<uuid>` id for a fixture document, derived from a readable key
 * so the seed stays idempotent and references can be written by name.
 */
export function fixtureId(type: DocumentType, key: string): string {
  return derivedId(type, key);
}

export const techId = (name: string): string => fixtureId('technology', name);
