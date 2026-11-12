# SEO

What the site emits for search engines, how it is verified, and what to do at launch (SPEC §13).

## What the site emits

- Unique `<title>` (≤ 60) and description (70–160) per page and locale, from content with catalog fallbacks (`src/lib/seo/metadata.ts`).
- Self-referencing canonical, hreflang `en` / `pt-BR` / `x-default` → `/en`.
- Open Graph + Twitter (`summary_large_image`). Dynamic `opengraph-image` / `twitter-image` (1200×630) per page via `next/og`.
- JSON-LD: Home = WebSite + Person + ProfilePage + featured ItemList. Index = CollectionPage + ItemList + BreadcrumbList. Detail = CreativeWork or SoftwareApplication + BreadcrumbList. Email and phone are never included.
- `sitemap.xml`: every public URL in both locales, `lastModified` from content, cover images, no hidden items, no admin, no `changefreq`/`priority`.
- `robots.txt`: allow `/`, `Disallow: /api/`, absolute sitemap. The admin path is not mentioned.
- Filtered listings (`?kind=`) are `noindex, follow` with a canonical to `/projects`. Paginated URLs self-canonicalize. `previousSlugs` answer 308. Unknown slugs answer 404. Unknown top-level paths (e.g. `/llms.txt`) answer 404.

## Verification

```sh
bun run check:seo          # starts next start unless SEO_BASE_URL is set
```

The home H1 is the display name; the job title is not in the H1 but stays visible and in the `<title>` and JSON-LD. The lead is under 70 characters, so the home meta description falls back to `meta.siteDescription` (D67).

CI runs it after `build` with `CONTENT_SOURCE=fixtures`. With JavaScript disabled it fetches every sitemap URL and asserts: status 200; exactly one `h1`; title ≤ 60 and description 70–160 characters; a self-referencing canonical; reciprocal hreflang (`en`, `pt-BR`, `x-default`); parseable JSON-LD without contact details; `alt` on every `img`; no `noindex`; no admin path in the HTML; `html-validate` clean; a 200 PNG behind every `og:image`; and **every** internal link resolving (each URL fetched once). Extras: robots and sitemap shape, the hidden project is 404, a previous slug answers 308 to the current one, the résumé answers 307, the filtered listing is `noindex` with a canonical to `/projects`, an unknown slug is 404, unknown top-level paths (`/zz-nope-123`, `/llms.txt`, `/.well-known/ard.json`) and anonymous `/admin` are real 404s with identical bodies, the API sends `X-Robots-Tag: noindex`, and, when `SESSION_SECRET` is set, `/admin` with a freshly signed test session answers 200 with `X-Robots-Tag: noindex`, `Cache-Control: no-store` and a robots meta `noindex`.

Unit tests cover the JSON-LD builders (required properties, resolvable `@id`s, absolute URLs) and the OG image renderer. Lighthouse SEO = 100 is enforced on Home, `/projects` and a detail page in both locales (D60).

## Launch checklist

1. Set `NEXT_PUBLIC_SITE_URL=https://juliolmuller.com` in production. Canonicals, the sitemap, OG URLs, HSTS and the `__Host-` cookie depend on it. The domain setup is described in [SETUP.md §6.6](./SETUP.md#66-custom-domain).
2. Add `GOOGLE_SITE_VERIFICATION` and `BING_SITE_VERIFICATION`, redeploy, and verify both properties.
3. Submit `https://juliolmuller.com/sitemap.xml` in Search Console and Bing Webmaster Tools.
4. URL Inspection on `/en`, `/pt`, `/en/projects` and one project per locale: indexable, canonical as declared, rendered HTML complete.
5. Rich Results Test and the Schema.org validator on Home (Person, WebSite, ProfilePage, ItemList), `/en/projects` (CollectionPage, BreadcrumbList) and a live project (SoftwareApplication).
6. Confirm in URL Inspection that `?kind=` URLs report "Excluded by noindex" and that a `previousSlugs` URL redirects (308).
7. PageSpeed Insights (mobile) on Home and a project page; compare with the CI Lighthouse reports.
8. Share a project URL in a social card validator and check the 1200×630 preview in both languages.
9. Re-run `bun run check:seo` with `SEO_BASE_URL=https://juliolmuller.com` against production.
