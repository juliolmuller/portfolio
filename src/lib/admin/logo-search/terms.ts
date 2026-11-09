const SUFFIX = /(?:^|\s)(?:js|jsx|ts|io|ai|com)$|(?<=[a-z0-9])(?:js|jsx)$/;

function base(query: string): string {
  return query
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Lowercase alphanumerics only: "Node.js" and "node js" both become "nodejs".
 */
export function compact(value: string): string {
  return base(value).replace(/[^a-z0-9]/g, '');
}

/**
 * Spellings worth trying, best first: the providers match differently (svgl by
 * title substring, so "nodejs" misses "Node.js"; Iconify by keyword, so
 * "node.js" misses). "Node.js" gives `node.js, nodejs, node, node js`.
 */
export function searchTerms(query: string): string[] {
  const original = base(query);
  const spaced = original
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const joined = spaced.replaceAll(' ', '');
  const stripped = spaced.replace(SUFFIX, '').trim();
  const first = spaced.split(' ')[0] ?? '';

  // eslint-disable-next-line perfectionist/sort-sets -- order is priority: providers try the first terms only
  return [...new Set([original, joined, stripped, first, spaced])].filter(
    (term) => term.length >= 2,
  );
}

/**
 * Lower is closer: exact 0, prefix 1, contains 2, otherwise 3.
 */
export function closeness(title: string, query: string): number {
  const a = compact(title);
  const b = compact(query);

  if (!a || !b) return 3;

  if (a === b) return 0;

  if (a.startsWith(b) || b.startsWith(a)) return 1;

  return a.includes(b) || b.includes(a) ? 2 : 3;
}
