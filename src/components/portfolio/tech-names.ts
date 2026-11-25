/**
 * Resolves technology or skill ids to names, skipping unknown ones.
 */
export function techNameLookup(items: ReadonlyArray<{ id: string; name: string }>) {
  const names = new Map(items.map((item) => [item.id, item.name]));

  return (ids: readonly string[]): string[] =>
    ids.map((id) => names.get(id)).filter((name): name is string => Boolean(name));
}
