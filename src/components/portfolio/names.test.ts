import { nameLookup } from './names';

const items = [
  { id: 'a', name: 'Alpha' },
  { id: 'b', name: 'Beta' },
  { id: 'c', name: 'Gamma' },
];

describe('nameLookup', () => {
  it('resolves names in the ids order', () => {
    expect(nameLookup(items)(['c', 'a'])).toEqual(['Gamma', 'Alpha']);
  });

  it('skips unknown ids', () => {
    expect(nameLookup(items)(['a', 'zzz', 'b'])).toEqual(['Alpha', 'Beta']);
  });

  it('drops repeated names, keeping the first one', () => {
    const twins = [...items, { id: 'd', name: 'Alpha' }];

    expect(nameLookup(twins)(['a', 'b', 'd'])).toEqual(['Alpha', 'Beta']);
  });

  it('returns an empty list for empty input', () => {
    expect(nameLookup(items)([])).toEqual([]);
    expect(nameLookup([])(['a'])).toEqual([]);
  });
});
