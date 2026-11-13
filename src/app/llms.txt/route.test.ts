import { describe, expect, it } from 'vitest';

import { GET } from './route';

describe('GET /llms.txt', () => {
  it('serves plain text that search engines do not index', async () => {
    const response = GET();

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex');
    expect(await response.text()).toMatch(/^# \S/);
  });
});
