import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Toaster } from './toaster';

describe('Toaster', () => {
  it('defaults to the bottom', () => {
    const html = renderToStaticMarkup(<Toaster />);

    expect(html).toContain('data-position="bottom"');
    expect(html).toContain('bottom-[calc(1rem+env(safe-area-inset-bottom))]');
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('pointer-events-none');
    expect(html).not.toContain('top-[');
  });

  it('renders at the top when asked', () => {
    const html = renderToStaticMarkup(<Toaster position="top" />);

    expect(html).toContain('data-position="top"');
    expect(html).toContain('top-[calc(1rem+env(safe-area-inset-top))]');
    expect(html).toContain('[--toast-from:-8px]');
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('pointer-events-none');
    expect(html).not.toContain('bottom-[');
  });
});
