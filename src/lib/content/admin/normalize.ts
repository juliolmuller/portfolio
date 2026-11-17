const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Turns form state into a candidate document: blank strings and empty objects
 * disappear (so optional fields are simply absent), blank rows leave lists, and
 * `null` is treated as absent. Arrays stay even when empty.
 */
export function pruneEmpty(value: unknown): unknown {
  if (typeof value === 'string') return value.trim() === '' ? undefined : value;

  if (value === null) return undefined;

  if (Array.isArray(value)) {
    return value.map(pruneEmpty).filter((item) => item !== undefined);
  }

  if (isObject(value)) {
    const entries = Object.entries(value)
      .map(([key, entry]) => [key, pruneEmpty(entry)] as const)
      .filter(([, entry]) => entry !== undefined);

    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
  }

  return value;
}

export type FieldErrors = Record<string, string>;

interface IssueLike {
  code: string;
  maximum?: bigint | number;
  message: string;
  minimum?: bigint | number;
  origin?: string;
  path: PropertyKey[];
}

function friendly(issue: IssueLike): string {
  if (issue.code === 'too_small' && issue.origin === 'string' && Number(issue.minimum) <= 1) {
    return 'Required';
  }

  if (issue.code === 'too_small' && issue.origin === 'array') {
    return `At least ${issue.minimum} ${Number(issue.minimum) === 1 ? 'item' : 'items'}`;
  }

  if (issue.code === 'too_big' && issue.origin === 'array') {
    return `At most ${issue.maximum} ${Number(issue.maximum) === 1 ? 'item' : 'items'}`;
  }

  if (issue.code === 'too_big' && issue.origin === 'string') {
    return `At most ${issue.maximum} characters`;
  }

  if (issue.code === 'invalid_type' && /received undefined/.test(issue.message)) {
    return 'Required';
  }

  return issue.message;
}

/**
 * One message per field path (the first), plus issues with no path.
 */
export function toFieldErrors(issues: readonly IssueLike[]): {
  fieldErrors: FieldErrors;
  formErrors: string[];
} {
  const fieldErrors: FieldErrors = {};
  const formErrors: string[] = [];
  for (const issue of issues) {
    const path = issue.path.map(String).join('.');

    if (!path) formErrors.push(friendly(issue));
    else fieldErrors[path] ??= friendly(issue);
  }

  return { fieldErrors, formErrors };
}
