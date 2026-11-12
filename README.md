# juliolmuller.com

Personal portfolio of Julio L. Muller, Senior Full Stack Software Engineer in Curitiba, Brazil. Bilingual (English and Brazilian Portuguese), dark only, server-rendered, with a working terminal, a 3D technology cloud and a private admin reachable only from that terminal.

The initial content is fictional demo data; [docs/USAGE.md](docs/USAGE.md) explains how to replace it.

## Features

- **Public site:** Home (hero, about, stack, selected work, résumé, contact, recommended people), `/projects` with a crawlable filter and pagination, project pages with a gallery lightbox, a résumé PDF route and an accessibility statement, all in `/en` and `/pt`.
- **Terminal:** a windowed shell (`Ctrl/Cmd + /`) that knows the site (`help`, `ls`, `cd`, `cat`, `open`, `goto`, `lang`, `projects`, `resume`, `neofetch`, `git log`, a few harmless easter eggs…), with history and Tab completion. It can be moved, resized, snapped, minimized and maximized, and becomes a bottom sheet on phones.
- **Technology cloud:** a rotating geoid of logos with category filters; the List view is the no-JS, reduced-motion and screen-reader equivalent.
- **Admin:** `su julio` in the terminal opens a session for `/admin`, where every piece of content is edited. Anonymous requests get the same 404 as any unknown URL.
- **Quality bar:** WCAG 2.2 AA, maximal SEO, strict security headers, no third-party requests or visitor cookies (only cookieless same-origin Vercel Web Analytics).

## Stack

Next.js 16.4 (App Router, Turbopack, `src/proxy.ts`) · React 19.3 · TypeScript 6.0 · Tailwind CSS 4.3 · next-intl 4 · Motion 14 · Sanity (server-only) or in-memory fixtures · zod 4 · `jose` sessions · Vitest, Playwright + axe, Lighthouse CI · Bun 1.4 (package manager and Next runtime), Node 24 (ESLint, Vitest, Playwright) · hosted on Vercel. Details in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Quick start

```sh
bun install
cp .env.example .env.local   # every variable is optional for a fixtures run
bun run dev                  # http://localhost:3000 → /en
```

With no Sanity variables the site runs on fixtures. To try the admin locally set `SESSION_SECRET` (32+ characters) and `ADMIN_PASSWORD` (or `ADMIN_PASSWORD_HASH` from `bun run admin:hash`), press `Ctrl + /`, type `su julio`, then `admin`. Full setup for local, GitHub, Sanity and Vercel: [docs/SETUP.md](docs/SETUP.md).

## Scripts

| Script                                          | What it does                                                                                   |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `dev` / `build` / `start`                       | Development server, production build, production server                                        |
| `lint`, `typecheck`                             | ESLint (incl. Prettier formatting, zero warnings), `tsc` after route type generation           |
| `test`, `test:watch`                            | Vitest unit tests                                                                              |
| `test:e2e`                                      | Playwright against the production build on port 3100 (run `build` first)                       |
| `check:seo`                                     | Crawl of every sitemap URL with JavaScript off, plus admin and API header checks               |
| `check:bundle`                                  | First-load and lazy-chunk budgets, admin isolation, server-only secret leaks (after `build`)   |
| `lhci`                                          | Lighthouse CI on Home, `/projects` and a detail page in both locales                           |
| `i18n:check`, `icons:audit`                     | Catalog/fixture parity; every technology resolves to an icon or a deliberate monogram          |
| `audit:deps`, `update`                          | `bun audit` at high severity; upgrade everything to latest (keeps ESLint 9 and TypeScript 6.0) |
| `admin:hash`                                    | Prints an `ADMIN_PASSWORD_HASH` for a password                                                 |
| `admin:smoke`                                   | Write-path smoke test against the Sanity `development` dataset (never production)              |
| `sanity:seed`, `sanity:schema`, `content:smoke` | Seed a dataset with the fictional data, print the schema, read-path smoke test                 |
| `fixtures:generate`                             | Regenerates the fixture images and metadata                                                    |

Visual snapshots run in CI; locally use `VISUAL=1 bun run test:e2e visual.spec.ts`.

## Environments

`next` → Vercel Preview at `https://next-juliolmuller.vercel.app` (Sanity `development`, `noindex`, behind Vercel login); `main` → production at `https://juliolmuller.com` (Sanity `production`). `main` still serves the old static portfolio through GitHub Pages until the launch merge — read [docs/SETUP.md §6.4](docs/SETUP.md#64-production-launch-one-time) before merging. All environment variables are listed in [docs/SETUP.md §3](docs/SETUP.md#3-environment-variables) and `.env.example`.

## Documentation

| Doc                                                                         | Audience and content                                                                                     |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| [docs/SETUP.md](docs/SETUP.md)                                              | Local, GitHub, Sanity and Vercel setup; env vars; launch, rollback, operations                           |
| [docs/USAGE.md](docs/USAGE.md)                                              | Signing in to the admin; updating page content; adding a portfolio item; troubleshooting                 |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)                                | How the system works now: rendering, content layer, auth, terminal, security, quality gates, limitations |
| [docs/DECISIONS.md](docs/DECISIONS.md)                                      | Why: every decision (D1–D68), spec contradictions, risks, assumptions                                    |
| [docs/PRODUCT.md](docs/PRODUCT.md)                                          | Purpose, signature features, non-goals, content rules, definition of done                                |
| [docs/SANITY.md](docs/SANITY.md)                                            | Project, datasets, tokens, schema, webhook, seeding, optional Studio                                     |
| [docs/SEO.md](docs/SEO.md) · [docs/ACCESSIBILITY.md](docs/ACCESSIBILITY.md) | What is emitted and verified; launch and manual checklists                                               |
| [docs/AI.md](docs/AI.md)                                                    | AI-assisted development history, Claude workflows, lessons learned                                       |
| [AGENTS.md](AGENTS.md) / [CLAUDE.md](CLAUDE.md)                             | Rules and conventions for AI agents (and humans)                                                         |
| [docs/archive/SPEC.md](docs/archive/SPEC.md)                                | Original implementation prompt, kept for history                                                         |

## Known limitations

- Lighthouse performance, LCP and TBT are enforced at regression floors, not at the original targets; initial JS is ~191 KB gzip against a 150 KB goal (D58, D60).
- The login rate limiter is per instance (in memory) and trusts `X-Forwarded-For`.
- PDF scanning does not inspect compressed object streams.
- The admin's unsaved-changes guard cannot intercept the browser's Back button.
