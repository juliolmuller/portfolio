/**
 * Resolves ids to names, skipping unknown ones and repeated names; keeps the
 * ids' order (the first occurrence of a name wins).
 */
export function nameLookup(items: ReadonlyArray<{ id: string; name: string }>) {
  const names = new Map(items.map((item) => [item.id, item.name]));

  return (ids: readonly string[]): string[] => {
    const resolved = ids.map((id) => names.get(id)).filter((name): name is string => Boolean(name));

    return [...new Set(resolved)];
  };
}
