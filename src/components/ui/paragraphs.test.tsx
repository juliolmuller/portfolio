import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Paragraphs } from './paragraphs';

const render = (text: string, className?: string): string =>
  renderToStaticMarkup(<Paragraphs text={text} className={className} />);

describe('Paragraphs', () => {
  it('renders a paragraph per blank line', () => {
    expect(render('a\n\nb').match(/<p/g)).toHaveLength(2);
  });

  it('renders exactly one paragraph without breaks', () => {
    expect(render('just one').match(/<p/g)).toHaveLength(1);
  });

  it('keeps a single line break visible', () => {
    const html = render('a\nb');

    expect(html.match(/<p/g)).toHaveLength(1);
    expect(html).toContain('a\nb');
    expect(html).toContain('whitespace-pre-line');
  });

  it('passes className to the wrapper', () => {
    expect(render('a', 'mt-3')).toMatch(/^<div class="[^"]*mt-3/);
  });

  it('renders nothing for empty text', () => {
    expect(render('')).toBe('');
    expect(render('\n\n')).toBe('');
  });

  it('escapes markup', () => {
    const html = render('<b onclick="x()">oi</b>\n\n<script>alert(1)</script>');

    expect(html).toContain('&lt;b');
    expect(html).toContain('&lt;script');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<b');
  });
});
