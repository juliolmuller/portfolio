/**
 * Resolves ids to names, skipping unknown ones; keeps the ids' order.
 */
export function nameLookup(items: ReadonlyArray<{ id: string; name: string }>) {
  const names = new Map(items.map((item) => [item.id, item.name]));

  return (ids: readonly string[]): string[] =>
    ids.map((id) => names.get(id)).filter((name): name is string => Boolean(name));
}
