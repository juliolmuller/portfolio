<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# juliolmuller.com — agent guide

Bilingual (en/pt), dark-only personal portfolio: Next.js 16 App Router on Vercel, content in Sanity (or in-memory fixtures), a windowed terminal, a 3D tech cloud, and an admin reachable only through the terminal (`su julio`). This file is the single source of project rules for every agent (Claude Code reads it via `CLAUDE.md`, Cursor reads it natively).

## Read before you change things

| You are touching…                       | Read                                                                                                                |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Anything architectural                  | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), then the matching decisions in [docs/DECISIONS.md](docs/DECISIONS.md) |
| Product intent, copy, non-goals         | [docs/PRODUCT.md](docs/PRODUCT.md)                                                                                  |
| Setup, env vars, GitHub, Vercel, deploy | [docs/SETUP.md](docs/SETUP.md)                                                                                      |
| Sanity schema, tokens, seeding, webhook | [docs/SANITY.md](docs/SANITY.md)                                                                                    |
| Admin behavior / content editing        | [docs/USAGE.md](docs/USAGE.md)                                                                                      |
| Metadata, JSON-LD, sitemap              | [docs/SEO.md](docs/SEO.md)                                                                                          |
| Anything interactive or visual          | [docs/ACCESSIBILITY.md](docs/ACCESSIBILITY.md)                                                                      |
| How AI agents work here, lessons        | [docs/AI.md](docs/AI.md)                                                                                            |

`docs/archive/SPEC.md` is the original prompt, kept for history only; where it disagrees with DECISIONS.md, DECISIONS.md wins.

## Commands (Bun 1.4 runs Next; Node 24 runs ESLint/Vitest/Playwright)

```sh
bun install && cp .env.example .env.local   # every variable is optional (fixtures run)
bun run dev                                 # http://localhost:3000 → /en
bun run lint && bun run typecheck
bun run test && bun run i18n:check && bun run icons:audit
bun run build && bun run check:bundle && bun run check:seo
bun run test:e2e                            # needs the build; own server on :3100
```

Run the relevant gates before saying something works. For UI work, run the dev server and drive it with Playwright (screenshots at 375, 768, 1440 px). Never claim an unrun check passed.

## Rules

**Code**

- TypeScript only, `strict` + `noUncheckedIndexedAccess`. No `any`, no `@ts-ignore`, no disabled lint rule without a justifying comment.
- Next 16 App Router with classic ISR (Cache Components is off, D1b). Never use deprecated APIs: `middleware.ts` (use `src/proxy.ts`), single-arg `revalidateTag`, `unstable_cache`, `setRequestLocale`.
- Server Components by default; `'use client'` only on interactive leaves. Modules imported by Server Components must not import client hooks.
- Named exports (default only where Next requires). kebab-case filenames. No barrel files except `src/lib/content/index.ts`. Tests colocated as `*.test.ts(x)`; e2e in `tests/e2e`.
- Env vars are read only through `src/env.ts` (the proxy may read `NODE_ENV`).
- Styling: Tailwind v4 tokens from `src/styles/globals.css` (`@theme`); default palette disabled (`bg-bg-0`, `text-text-2`, `border-line`…). `cn()` from `@/lib/cn`, variants with `cva`. **Dark only**: no `dark:` variants, light themes or `prefers-color-scheme`.
- Internal links on public pages use `Link` from `@/i18n/navigation`, never `next/link`.
- Animate only `transform`/`opacity` (and `filter` sparingly). No React state updates per animation frame (write styles via refs in rAF). Honor `useReducedMotionPreference()` / `data-motion='reduced'`.
- Formatting is handled by `eslint-config-any` (Prettier embedded; no Prettier config in the repo). Husky runs lint-staged on commit, commitlint on commit-msg, typecheck on push.

**Data layer**

- All content flows through `ContentRepository` from `@/lib/content`. Pages, components, the terminal snapshot, the sitemap and the admin never import Sanity (`@sanity/*`, `src/lib/content/sanity/*`, `groq-js`) directly; ESLint enforces it.
- Two adapters (`sanity`, `fixtures`) share one pipeline and pass the same contract tests. zod schemas in `src/lib/content/schema.ts` are the single contract; types are `z.infer`.
- Reads skip and log invalid documents; writes reject with field-level errors. Hidden items (`visible: false`) never reach any public output (HTML, sitemap, terminal, JSON-LD). The phone number never appears in metadata, structured data or the terminal.
- Sanity is contacted only from the server. Reads: `fetch` with `next: { tags }` (`content:*`). Writes: `updateTag` plus `revalidatePath` for affected routes.
- **Data policy:** seed content is fictional (`isFixture: true`, `example.com`). The only real facts are in `src/config/site.ts` plus owner-supplied photos. Never present anything else as a real claim about the owner. No lorem ipsum or TODO in rendered text.

**i18n**

- Locales `en` (default) and `pt`; `pt-BR` for `<html lang>`, hreflang and `Intl`; `pt_BR` for Open Graph (`src/i18n/routing.ts`).
- No hard-coded user-facing string in public components (text, `aria-label`, `alt`, tooltips, toasts, terminal output): use `messages/{en,pt}.json` via next-intl. Exceptions: the admin UI (English) and the lazy secret-command module.
- Add every key to both files in the same commit. Write Portuguese natively (first person, natural syntax; keep deploy, backend, framework, pipeline, commit), never literally translated. No exclamation marks, no emoji, sentence case. Proper nouns aren't translated.
- Repository content arrives resolved to one locale; components never receive `{ en, pt }`. Format dates/numbers/lists with `Intl`/next-intl. Server Actions and Route Handlers can't read root params: pass the locale explicitly.
- Only `/` negotiates a locale; `NEXT_LOCALE` is written only on an explicit switch.

**Accessibility (WCAG 2.2 AA minimum)**

- Native elements first, ARIA only when needed. One `h1` per page, logical headings, labelled landmarks, real lists, `<time datetime>`.
- Icon-only controls have accessible names; decorative SVGs `aria-hidden`; visible label text is contained in the accessible name (2.5.3).
- Targets ≥ 44×44 CSS px (never below 24×24); every drag has a pointer-single and keyboard alternative; shortcuts use modifiers.
- Visible `:focus-visible` ring (2px `accent-2`, offset 2px) never hidden by the header or terminal; no keyboard traps except true modals (native `<dialog>` + `showModal()`).
- Contrast: body text 7:1, other text 4.5:1, UI/focus 3:1. `src/styles/tokens.test.ts` guards tokens; extend it before using `text-3` on a new surface.
- Honor `prefers-reduced-motion`, the "Pause animations" toggle, `prefers-contrast: more`, `forced-colors` (add the `decorative` class to decorative layers) and `prefers-reduced-transparency`. No flashing above 3 Hz.
- Polite live regions for toasts, filter results, copy confirmations, terminal output and tech-cloud captions. Content stays fully visible without JavaScript.
- Verify with `@axe-core/playwright`: zero violations.

**Security and privacy**

- Server-only modules start with `import 'server-only'`. Secrets are never `NEXT_PUBLIC_`, never imported by client code, never printed in logs, tests, screenshots or errors (env validation reports names only).
- The admin path never appears in robots.txt, sitemap, public HTML, client bundles or catalogs. Anonymous `/admin/**` gets the same global 404 as any unknown path — never 401, 403 or a redirect. Every admin Server Component, Route Handler and Server Action calls `requireAdmin()`; never rely on the proxy or client state alone.
- Passwords are never stored in terminal state, history, sessionStorage, console or error reports. Auth failures are generic and delayed to a constant minimum.
- zod at every boundary; URL allowlists (`https:`, plus `mailto:`/`tel:` only where specified); no `javascript:`/`data:`.
- No `dangerouslySetInnerHTML` except the escaped JSON-LD serializer and the constant motion-init script (D21). Markdown goes through `rehype-sanitize`; custom SVG through the allowlist parser.
- No browser requests to third-party origins; the server never fetches URLs supplied by visitors or admin content, except the admin-only logo fetch (D73, D74). Mutating Route Handlers verify `Origin` and `Sec-Fetch-Site`; no state change on GET; admin responses `no-store`.
- Analytics is cookieless same-origin Vercel Web Analytics only (D68). The only visitor cookie is `NEXT_LOCALE`.

## Working agreement

- **Decide and document** instead of asking, unless blocked. Add non-obvious decisions to `docs/DECISIONS.md` as the next `D<n>` (context → decision → consequence) under the right topic; mark replaced ones superseded, never delete or renumber.
- **Docs ship with the change.** Behavior, env var, script, CI or setup changes update the matching guide in the same commit.
- Owner requests beat the original spec; record the override.
- Conventional Commits (`feat(scope):`, `fix(scope):`, `docs:`, `ci:`, `test:`…), small and focused. Never commit secrets or `.env*` (only `.env.example`). Never point local work or tests at the Sanity `production` dataset.
- Keep the `BEGIN/END:nextjs-agent-rules` block above intact; `next dev` re-adds it.
