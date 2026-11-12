import { icons as lucideIcons } from 'lucide-react';

import { documentSchemas, documentTypes } from '../schema';
import { createFixtureDataset } from './dataset';

const dataset = createFixtureDataset();

const pascalCase = (name: string): string =>
  name.replace(/(^|-)([a-z0-9])/g, (_, __, char: string) => char.toUpperCase());

function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => collectStrings(item, out));
  else if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => collectStrings(item, out));
  }

  return out;
}

describe('fixture dataset', () => {
  it.each(documentTypes)('every %s document passes strict validation', (type) => {
    for (const document of dataset[type]) {
      const result = documentSchemas[type].safeParse(document);

      expect(
        result.success,
        `${type} ${document.id}: ${result.error?.issues
          .map((issue) => `${issue.path.join('.')} ${issue.message}`)
          .join('; ')}`,
      ).toBe(true);
    }
  });

  it('flags every document as fixture data', () => {
    for (const type of documentTypes) {
      for (const document of dataset[type]) {
        expect(document.isFixture).toBe(true);
      }
    }
  });

  it('has unique ids in the <type>.<uuid> format', () => {
    const ids = documentTypes.flatMap((type) => dataset[type].map((document) => document.id));

    expect(new Set(ids).size).toBe(ids.length);
    for (const type of documentTypes) {
      for (const { id } of dataset[type]) {
        if (id === type) continue;

        expect(id).toMatch(
          new RegExp(
            `^${type}\\.[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`,
          ),
        );
      }
    }
  });

  it('uses only example.com links outside the technology inventory', () => {
    const urls = collectStrings(
      documentTypes.filter((type) => type !== 'technology').map((type) => dataset[type]),
    ).filter((value) => /^(?:https?:|mailto:)/.test(value));

    expect(urls.length).toBeGreaterThan(10);
    for (const url of urls) {
      expect(url).toMatch(/^(https:\/\/example\.com(\/|$)|mailto:[^@]+@example\.com$)/);
    }
    expect(dataset.contact[0]?.email).toMatch(/@example\.com$/);
  });

  it('contains no placeholder text', () => {
    const text = collectStrings(dataset).join('\n');

    expect(text).not.toMatch(/lorem ipsum/i);
    // Case-sensitive: "todo" is a Portuguese word.
    expect(text).not.toMatch(/\b(?:TODO|TBD|FIXME)\b/);
  });

  it('references Lucide icons that exist', () => {
    for (const link of dataset.featuredLink) {
      if (!link.icon.startsWith('lucide:')) continue;

      expect(pascalCase(link.icon.slice('lucide:'.length)) in lucideIcons).toBe(true);
    }
  });

  it('references Devicon link icons that exist', async () => {
    const { resolveLinkIcon } = await import('../icons/resolve');
    const slugs = dataset.featuredLink
      .map((link) => link.icon)
      .filter((icon) => icon.startsWith('devicon:'));

    expect(slugs.length).toBeGreaterThan(0);

    for (const icon of slugs) {
      expect((await resolveLinkIcon(icon)).type, icon).toBe('svg');
    }
  });

  it('covers every project kind and the Appendix A cases', () => {
    const projects = dataset.project;

    expect(new Set(projects.map((project) => project.kind)).size).toBe(6);
    expect(projects.filter((project) => project.featured)).toHaveLength(3);
    expect(projects.filter((project) => project.visible === false)).toHaveLength(1);
    expect(projects.find((project) => project.slug === 'invoice-bot')?.cover).toBeUndefined();
    expect(projects.find((project) => project.slug === 'pay-bridge')?.previousSlugs).toEqual([
      'paybridge',
    ]);
  });
});
