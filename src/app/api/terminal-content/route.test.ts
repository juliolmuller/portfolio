import { describe, expect, it } from 'vitest';

import { GET } from './route';

describe('GET /api/terminal-content', () => {
  it('is never cached by a CDN, so hidden items cannot linger', async () => {
    const response = await GET(new Request('http://localhost/api/terminal-content?locale=en'));

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it.each(['en', 'pt'])('includes localized skills (%s)', async (locale) => {
    const response = await GET(
      new Request(`http://localhost/api/terminal-content?locale=${locale}`),
    );
    const body = (await response.json()) as {
      skills: Array<{ categories: string[]; name: string }>;
    };

    expect(body.skills.length).toBeGreaterThan(0);

    for (const skill of body.skills) {
      expect(skill.name).not.toBe('');
      expect(skill.categories.length).toBeGreaterThan(0);
    }
  });

  it('404s on an unknown locale', async () => {
    const response = await GET(new Request('http://localhost/api/terminal-content?locale=xx'));

    expect(response.status).toBe(404);
  });
});
