import { type Skill } from '@/lib/content/types';

import { toStackItems } from './to-stack-items';

const svg = { viewBox: '0 0 24 24', paths: ['M0 0h24v24H0z'] };

function skill(id: string, extra: Partial<Skill> = {}): Skill {
  return {
    id,
    name: id,
    categories: ['language'],
    inCloud: false,
    order: 1,
    priority: 2,
    ...extra,
  };
}

describe('toStackItems (#74)', () => {
  const result = toStackItems([
    skill('a', { icon: svg, inCloud: true, url: 'https://example.com', brandColor: '#fff' }),
    skill('b', { icon: { monogram: 'B' }, inCloud: true, categories: ['language', 'engineering'] }),
    skill('c'),
    skill('d', { icon: svg, inCloud: false }),
    skill('e', { inCloud: true }),
  ]);

  it('keeps every skill in input order with public icons', () => {
    expect(result.items.map((item) => item.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(result.items[0]?.icon).toEqual({
      src: expect.stringMatching(/^\/tech-icons\/.{14}\.svg$/),
    });
    expect(result.items[1]?.icon).toEqual({ monogram: 'B' });
  });

  it('leaves icon-less skills without an icon and out of the cloud', () => {
    expect(result.items[2]).not.toHaveProperty('icon');
    expect(result.cloudItems.map((item) => item.id)).not.toContain('c');
  });

  it('keeps inCloud:false skills out of the cloud and guards a bad flag', () => {
    expect(result.cloudItems.map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('keeps categories, priority, url and brand color on cloud items', () => {
    expect(result.cloudItems[0]).toMatchObject({
      categories: ['language'],
      priority: 2,
      url: 'https://example.com',
      brandColor: '#fff',
    });
    expect(result.cloudItems[1]?.categories).toEqual(['language', 'engineering']);
  });

  it('never ships paths to the client', () => {
    expect(JSON.stringify(result)).not.toContain('paths');
    expect(JSON.stringify(result)).not.toContain('M0 0h24');
  });
});
