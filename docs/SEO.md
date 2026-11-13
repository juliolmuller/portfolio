# SEO

What the site emits for search engines, how it is verified, and what to do at launch (SPEC §13).

## What the site emits

- Unique `<title>` (≤ 60) and description (70–160) per page and locale, from content with catalog fallbacks (`src/lib/seo/metadata.ts`).
- Self-referencing canonical, hreflang `en` / `pt-BR` / `x-default` → `/en`.
- `/` answers 307 to `/en` or `/pt` (cookie → `Accept-Language` → `en`; `Vary: Accept-Language, Cookie`, `private, no-store`) and is never advertised: not in the sitemap, canonicals, hreflang, internal links or JSON-LD URLs.
- Open Graph + Twitter (`summary_large_image`). Dynamic `opengraph-image` / `twitter-image` (1200×630) per page via `next/og`.
- JSON-LD (`WebSite.url` is the locale home with a stable `@id`, D88): Home = WebSite + Person + ProfilePage + featured ItemList. Index = CollectionPage + ItemList + BreadcrumbList. Detail = CreativeWork or SoftwareApplication + BreadcrumbList. Email and phone are never included.
- `sitemap.xml`: every public URL in both locales, `lastModified` from content, cover images, no hidden items, no admin, no `changefreq`/`priority`.
- `llms.txt`: Markdown (`text/plain`, `noindex`), H1 = display name, summary from `site.ts`, links to Home, Projects and Accessibility in both locales; no repository content (D85).
- `robots.txt`: allow `/`, `Disallow: /api/`, absolute sitemap. The admin path is not mentioned.
- Filtered listings (`?kind=`) are `noindex, follow` with a canonical to `/projects`. Paginated URLs self-canonicalize. `previousSlugs` answer 308. Unknown slugs answer 404. Unknown top-level paths answer a real 404 (D84); `/.well-known/ard.json` is one of them on purpose (no ARD manifest, D86).

## The root redirect and Search Console

`/` answers 307 by design (D3, D18, D88). Search Console's "Page with redirect" for `/`, and for the `http://` and `www.` variants, `previousSlugs` URLs and `/<locale>/resume`, is expected. It needs no fix and no "Validate fix". A redirecting URL is never indexed itself; Google indexes the destination.

- Googlebot sends no `Accept-Language` and no cookie, so it always gets `/en`, consistent with `x-default` and the canonical.
- 307 rather than 301/308: the target depends on the visitor, and a permanent redirect would be cached as one language for everyone.
- `x-default` points at `/en`, not `/`, because hreflang targets must answer 200.
- Only the bare root auto-redirects. Language versions never redirect to each other, and `NEXT_LOCALE` is written only on an explicit switch, in line with Google's multilingual guidance.
- Check instead: URL Inspection on `/en` and `/pt` shows "URL is on Google" with the user-declared canonical equal to the Google-selected one, and the submitted sitemap has no URLs under "Page with redirect". Optionally re-read the _Pages_ report after launch-related or routing changes.

Sources: [Managing multi-regional and multilingual sites](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites) and [Search Central office hours, July 2023](https://developers.google.com/search/help/office-hours/2023/july).

## Verification

```sh
bun run check:seo          # starts next start unless SEO_BASE_URL is set
```

The home H1 is the display name; the job title is not in the H1 but stays visible and in the `<title>` and JSON-LD. The lead is under 70 characters, so the home meta description falls back to `meta.siteDescription` (D67).

CI runs it after `build` with `CONTENT_SOURCE=fixtures`. With JavaScript disabled it fetches every sitemap URL and asserts: status 200; exactly one `h1`; title ≤ 60 and description 70–160 characters; a self-referencing canonical; reciprocal hreflang (`en`, `pt-BR`, `x-default`); parseable JSON-LD without contact details; `alt` on every `img`; no `noindex`; no admin path in the HTML; `html-validate` clean; a 200 PNG behind every `og:image`; and **every** internal link resolving (each URL fetched once). Extras: a crawler-like request to `/` (no cookie, no `Accept-Language`) answers 307 to `/en` with `Vary` and `no-store`; the bare root appears in no sitemap `loc`, canonical, hreflang `href`, `og:url`, JSON-LD URL or internal link; robots and sitemap shape, `/llms.txt` (one H1, no HTML, no private data, every link resolves), the hidden project is 404, a previous slug answers 308 to the current one, the résumé answers 307, the filtered listing is `noindex` with a canonical to `/projects`, an unknown slug is 404, unknown top-level paths (`/zz-nope-123`, `/.well-known/ard.json`) and anonymous `/admin` are real 404s with identical bodies, the API sends `X-Robots-Tag: noindex`, and, when `SESSION_SECRET` is set, `/admin` with a freshly signed test session answers 200 with `X-Robots-Tag: noindex`, `Cache-Control: no-store` and a robots meta `noindex`.

Unit tests cover the JSON-LD builders (required properties, resolvable `@id`s, absolute URLs, `WebSite.url` as the locale home with a stable `@id`) and the OG image renderer. Lighthouse SEO = 100 is enforced on Home, `/projects` and a detail page in both locales (D60).

## Launch checklist

1. Set `NEXT_PUBLIC_SITE_URL=https://juliolmuller.com` in production. Canonicals, the sitemap, OG URLs, HSTS and the `__Host-` cookie depend on it. The domain setup is described in [SETUP.md §6.6](./SETUP.md#66-custom-domain).
2. Add `GOOGLE_SITE_VERIFICATION` and `BING_SITE_VERIFICATION`, redeploy, and verify both properties.
3. Submit `https://juliolmuller.com/sitemap.xml` in Search Console and Bing Webmaster Tools.
4. URL Inspection on `/en`, `/pt`, `/en/projects` and one project per locale: indexable, canonical as declared, rendered HTML complete.
5. Search Console will list `/` (and `http://`, `www.`, old slugs) as "Page with redirect". This is expected (see above): do not "Validate fix"; check `/en` and `/pt` instead.
6. Rich Results Test and the Schema.org validator on Home (Person, WebSite, ProfilePage, ItemList), `/en/projects` (CollectionPage, BreadcrumbList) and a live project (SoftwareApplication).
7. Confirm in URL Inspection that `?kind=` URLs report "Excluded by noindex" and that a `previousSlugs` URL redirects (308).
8. PageSpeed Insights (mobile) on Home and a project page; compare with the CI Lighthouse reports.
9. Share a project URL in a social card validator and check the 1200×630 preview in both languages.
10. Re-run `bun run check:seo` with `SEO_BASE_URL=https://juliolmuller.com` against production.
