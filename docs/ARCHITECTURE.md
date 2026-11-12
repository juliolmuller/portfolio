# Architecture

The current shape of the system. Why it is this way (and what was tried first) is in [DECISIONS.md](./DECISIONS.md); ids like `D53` point there. Product intent is in [PRODUCT.md](./PRODUCT.md).

## Stack

| Layer               | Choice                                                                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework           | Next.js 16.4 App Router, Turbopack, `src/proxy.ts`; React 19.3 (**not** the Next.js of older training data — read `node_modules/next/dist/docs/`) |
| Language            | TypeScript 6.0 strict + `noUncheckedIndexedAccess` (D5)                                                                                           |
| Styling             | Tailwind CSS 4.3 (`@theme` tokens in `src/styles/globals.css`), Geist + JetBrains Mono, ten self-hosted title fonts                               |
| i18n                | next-intl 4, precompiled ICU messages, locale from `next/root-params` (D2, D57)                                                                   |
| Motion              | Motion 14 `LazyMotion` + CSS; hand-written rAF loops for the geoid and window dragging                                                            |
| State               | Zustand (window manager, terminal, session, toasts) — client only                                                                                 |
| Content             | Sanity (server only) or in-memory fixtures behind one `ContentRepository`                                                                         |
| Validation          | zod 4 at every boundary; types are `z.infer`                                                                                                      |
| Auth                | Single admin: scrypt hash or HMAC'd plaintext, HS256 JWT cookie via `jose`                                                                        |
| Images / uploads    | `next/image`; `sharp` for uploads and fixtures                                                                                                    |
| Analytics           | `@vercel/analytics`, cookieless, same-origin                                                                                                      |
| Tests               | Vitest (unit), Playwright + axe (e2e: Chromium, WebKit, Firefox smoke, mobile), Lighthouse CI                                                     |
| Runtime and tooling | Bun 1.4 (package manager, `next dev/build/start`, scripts); Node 24 for ESLint, Vitest, Playwright (D24)                                          |
| Hosting             | Vercel, Bun function runtime (beta) (D11, D24)                                                                                                    |

## Source layout

```text
src/
  app/
    [locale]/        public root layout (<html lang>), page, projects/, accessibility/, resume/ route, OG images
    admin/           own root layout; [area]/ (list, new, [id]) driven by areas config; api/upload/route.ts
    api/             terminal-content (snapshot), revalidate (Sanity webhook)
    tech-icons/      content-hashed, immutable SVG logos
    sitemap.ts robots.ts manifest.ts icon.* global-not-found.tsx dev/ui (404 in production)
  proxy.ts           canonical URLs, admin gate, locale negotiation for "/", admin nonce CSP
  components/        layout/ sections/ portfolio/ tech-cloud/ window-manager/ terminal/ admin/ ui/ seo/ markdown/
  lib/
    content/         schema.ts (zod contract), repository, pipeline, sanity/ fixtures/ admin/ icons/
    auth/            session, token, password, rate-limit, cookie, actions
    admin/           upload sanitizers (image, pdf, svg), actions
    terminal/        pure TS core: parser, vfs, registry, engine, completion, commands/{public,secret}
    window-manager/  geometry (pure)         tech-cloud/  motion math (pure)
    timeline-rail.ts  rail tip easing/anchor math (pure; tip follows a fine pointer, D81)
    security/        headers.ts (dependency-free, also imported by next.config.ts)
    seo/             metadata, json-ld, og-image
  i18n/  stores/  config/site.ts  env.ts  styles/
messages/            en.json pt.json
sanity/              schema.ts (plain data), studio.ts (optional Studio layer), documents.ts (storage converter)
scripts/             check-seo, check-bundle, i18n-check, icons-audit, seed-sanity, content-smoke, admin-smoke, admin-hash, ...
tests/               e2e/ (+ __screenshots__), support/ (sanity-memory), stubs/
```

Conventions that keep this layout honest: server-only modules import `server-only`; named exports, kebab-case files, colocated `*.test.ts(x)`; no barrel files except `src/lib/content/index.ts`; env is read only through `src/env.ts`. See [AGENTS.md](../AGENTS.md).

## Rendering and caching

- All public routes are **prerendered** (`generateStaticParams` for locales and known slugs) with classic ISR: `revalidate = 86400` as a fallback, tag-based on-demand revalidation. Cache Components is **off** because streamed responses always start with `200`, so unknown slugs could not be real 404s nor `previousSlugs` real 308s (D1b).
- `/[locale]/projects` is request-rendered (it reads `searchParams`); invalid `?kind=`/`?page=` are real 404s (D33, D35).
- The admin tree is fully dynamic, `no-store`, nonce-CSP.
- Sanity reads: plain `fetch` to the HTTP API, `perspective=published`, no CDN, `cache: 'force-cache'`, `next: { revalidate: 86400, tags: ['content:*'] }` (D26). `@sanity/client` is used only for writes, uploads and the seed.
- Revalidation: admin Server Actions call `updateTag` for `tagsForDocument(...)` plus `revalidatePath('/sitemap.xml')` (and `/` in fixtures mode); the webhook calls `revalidateTag(tag, { expire: 0 })` (D9, D53). Build-time Sanity failures fail the build; runtime failures keep serving cache.

## Request flow (`src/proxy.ts`)

In order: (1) canonicalization (lowercase → 308); (2) **admin gate** for `/admin/**`: verify the JWT with `jose`, otherwise rewrite to a nonexistent path so Next renders the **same global 404** as any unknown URL (D3, D19); allowed requests get the admin headers and a per-request nonce CSP; the session cookie is re-issued at most once a minute and never for Server Action posts (D51); (3) locale negotiation for `/` only: cookie → `Accept-Language` → `en`, 307 (D18). Any other unprefixed path is a real 404.

## Content layer

```text
pages / components / terminal snapshot / sitemap / admin
        │ only via @/lib/content (ESLint-enforced)
        ▼
  createRepository(source)  ← one pipeline (D25):
        │   strip nulls → fill empty pt from en (warn) → strict zod parse (skip+log invalid)
        │   → visibility filter → sort by order,id → drop duplicate slugs
        │   → drop hidden/unknown technology refs → resolve locale + icons
   ┌────┴─────┐
 fixtures   sanity (GROQ over fetch)        ← adapters only fetch raw docs
```

- `zod` schemas in `src/lib/content/schema.ts` are the single contract. Components receive content already resolved to one locale; they never see `{ en, pt }`.
- Both adapters pass the same contract tests; the Sanity adapter is tested offline by evaluating its real GROQ with `groq-js` against converted fixtures (D27). `groq-js` is banned outside `src/lib/content` and `scripts`.
- **Sanity storage shape:** localized fields are `{ en, pt }` objects; keyed arrays (`_key` = sha1 of path); references for technologies; images with localized alt and hotspot; singletons use their type as `_id` (`profile`, `contact`, `resume`); collection ids are `<type>.<uuid>` (D28).
- **Admin write path** (`src/lib/content/admin/`): `AdminStore` (fixtures and Sanity adapters; lists include hidden, unvalidated docs so broken ones can be fixed) behind `AdminService`, the only place that validates, cross-checks (slug uniqueness incl. `previousSlugs`, technology references), assigns ids/order, writes, revalidates and logs `{event, type, id, action}` (never content). Sanity writes use `ifRevisionId` for optimistic concurrency; a 409 becomes the conflict dialog. Toggles and reorders skip full validation (D53).
- **Uploads:** only through `POST /admin/api/upload` (session, same-origin, 60 per 10 min). Images identified by magic bytes, re-encoded with sharp, metadata/GPS dropped; PDFs must start with `%PDF-` and have no `/JavaScript`, `/JS`, `/Launch` (compressed streams are not inspected). SVG is never uploaded: icons are sanitized into `{ viewBox, paths }`. Limit 4 MB each, `Content-Length` required (D10, D54, R3).
- **Data policy:** all seed content is fictional (`isFixture: true`, `example.com`). The only real facts are in `src/config/site.ts` and owner-supplied photos.

## Terminal and window manager

- `src/lib/terminal` is pure TS (tokenizer, output AST, virtual file system, registry, async-generator engine, completion, history). The React shell in `src/components/terminal` is one lazy chunk; strings are a lazy per-locale catalog. Content comes from `GET /api/terminal-content?locale=` (`no-store`, `noindex`; no phone, icons, file URLs or hidden items) (D50).
- **Secret commands** (`su`, `admin`, `logout`) live in a separate dynamically imported module, English only, never in catalogs; without a session they are byte-identical to unknown commands. Secret lines are volatile (never stored, never in history) (D52).
- The window manager (`src/lib/window-manager` geometry, `src/stores/window-store.ts`) writes gesture styles straight to the DOM in rAF and commits on release; `Esc` reverts; snap uses hysteresis (8 px arm / 32 px release) (D49, D63). State persists in `sessionStorage` (`jm.window.<id>.v1`, `jm.terminal.v1`).

## Technology cloud

Server resolves each technology to a content-hashed SVG file served from `/tech-icons/<hash>.svg` (`?fill=` for the geoid), so no icon paths reach the client or the HTML twice (D59). The geoid is a full-bleed ellipsoid (`80svh`, min 600 px) with frame-time-scaled motion, yaw-only drag, category chips and exclusive filtering (D37–D45, D66). SSR, no-JS, reduced motion and Pause animations render the grouped List view. Icon resolution order: Simple Icons → Devicon-plain → monogram (D13).

## Security

- **Headers** (`src/lib/security/headers.ts`): static public CSP (`script-src 'self' 'unsafe-inline'`, no third-party origins, `style-src-attr 'unsafe-inline'`), nonce CSP for the admin, HSTS and `upgrade-insecure-requests` only when the site URL is https, `nosniff`, `X-Frame-Options: DENY`, COOP/CORP same-origin, restrictive `Permissions-Policy`. Set on **every** path so the admin 404 matches any other 404 (D4, D56).
- **Admin invisibility:** never in robots.txt, sitemap, public HTML, client bundles or catalogs. Admin-only headers (`noindex` with AI opt-outs `noai, noimageai`, `no-referrer`, `no-store`) are added by the proxy **only on the allowed branch** (D51).
- **Session:** `__Host-jm_session` (`Secure`) when the site URL is https, plain `jm_session` otherwise; HttpOnly, SameSite=Strict. 30 min idle / 8 h absolute. `requireAdmin()` in every admin RSC, Route Handler and Server Action.
- **Brute force:** in-memory limiter (5 failures/15 min lockout, doubling; 30/hour global pause), client = HMAC of the first `x-forwarded-for`; every login response ≥ 800 ms + jitter. Per instance on serverless (known gap; Upstash is the reserved seam).
- **Boundaries:** zod everywhere, `rehype-sanitize` Markdown, https-only URL allowlists, no `dangerouslySetInnerHTML` except the escaped JSON-LD and the constant motion-init script (D21), no server fetches of user-supplied URLs, webhook signature (`sanity-webhook-signature`, 10-minute tolerance), `check:bundle` fails if a server-only variable name or value reaches the client.

## i18n

`en` (default) and `pt` (`pt-BR` for `<html lang>`, hreflang, `Intl`; `pt_BR` for Open Graph). No hard-coded public strings; admin UI and the secret module are English only. Only `/` negotiates; `NEXT_LOCALE` is written only on an explicit switch.

## SEO and accessibility

Server-rendered HTML, unique metadata and canonical/hreflang per page, JSON-LD, sitemap, `next/og` images, `noindex` on previews, filters and the API — see [SEO.md](./SEO.md). WCAG 2.2 AA with axe, keyboard, zoom, forced-colors and reduced-motion runs — see [ACCESSIBILITY.md](./ACCESSIBILITY.md). Dark only; no skill meters.

## Quality gates

| Gate                        | What it enforces                                                                                                                               |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `lint` (`--max-warnings=0`) | ESLint 9 + jsx-a11y strict, Sanity/groq-js import bans                                                                                         |
| `typecheck`                 | `next typegen` + `tsc --noEmit`                                                                                                                |
| `test`                      | Vitest: core libs, schemas, both adapters, auth, JSON-LD, token contrast                                                                       |
| `i18n:check`, `icons:audit` | Same keys/placeholders in both catalogs and fixtures; every technology has an icon or monogram                                                 |
| `check:bundle`              | Home ≤ 195 KB gzip first load, projects/detail ≤ 191, lazy chunks (terminal ≤ 20, secret ≤ 3, sphere ≤ 10); admin path/server-only leaks (D58) |
| `check:seo`                 | Crawls every sitemap URL with JS off (D32)                                                                                                     |
| `test:e2e`                  | Playwright on a fixtures production build, port 3100; axe on Chromium (D23)                                                                    |
| `lhci`                      | Accessibility/SEO = 1, best-practices ≥ 0.95, CLS ≤ 0.05; regression floors for performance ≥ 0.85, LCP ≤ 3.8 s, TBT ≤ 350 ms (D60)            |

## Known limitations

- Performance targets of the original spec (initial JS ≤ 150 KB, LCP < 2 s, TBT < 150 ms, Lighthouse perf ≥ 95) are **not met**; enforced at regression floors (D58, D60).
- Login rate limiter is per instance and trusts `X-Forwarded-For`.
- PDF scanning does not inspect compressed object streams.
- The admin's unsaved-changes guard cannot intercept the browser Back button.
- Bun runtime on Vercel is beta; if ISR or `sharp` misbehaves, drop `bunVersion` from `vercel.json` (Bun stays the package manager) and record it (D24).
- Public CSP keeps `script-src 'unsafe-inline'` until Next supports hashes for inline flight data (D4).
