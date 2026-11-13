# Product brief

What the site is for and what must stay true. This replaces the product parts of the original spec ([archive/SPEC.md](./archive/SPEC.md)); how it is built is in [ARCHITECTURE.md](./ARCHITECTURE.md), why in [DECISIONS.md](./DECISIONS.md).

## Purpose

Personal site of **Julio L. Muller**, Senior Full Stack Software Engineer in Curitiba, Brazil: a multi-disciplinary developer (mobile, desktop, automation, integrations) whose core is web systems. It presents him professionally, showcases a portfolio and proves craft through the site itself.

**Audience.** Recruiters and hiring managers (skim in under a minute), engineering leaders (depth and judgment), prospective clients and collaborators.

**Success.** In 10 seconds a visitor knows who he is, what he does and where to click next. Resume and contact are one click away. Modern and alive without gimmicks, excellent on phones, fast, accessible, crawlable. The owner changes every piece of public content without touching code.

## Signature features (non-negotiable)

1. An OS-style **terminal window**: draggable, resizable, snappable, minimizable, maximizable, a bottom sheet on phones.
2. An animated **technology cloud** (logos, names on hover/tap) — never skill meters.
3. **Portfolio cards** (snapshot, short description, up to two CTAs), a dedicated page per project, featured projects on Home.
4. **Bilingual** (English, Brazilian Portuguese) for every public text field.
5. **Dark-only** identity.
6. **Fully editable content** via a private admin backed by Sanity.
7. **Admin reachable only through secret terminal commands**; invisible, non-indexable, and a plain 404 to everyone without a session.
8. **Search and accessibility excellence**: server-rendered pages, structured data, WCAG 2.2 AA.

## Non-goals

No light theme, theme toggle, `prefers-color-scheme` branching or `dark:` variants. No skill bars, percentages, stars or any proficiency visual (site or terminal). No Sanity Studio embedded in the app. No backend, database or auth provider beyond Sanity and the single admin; no public sign-up. No login page, link or route hint on the public site. No blog. No cookie banner (only cookieless same-origin analytics, D68). No browser requests to third-party origins (fonts, icons, images are same-origin; Sanity is server-only). No scroll-hijacking libraries, autoplay audio or flashing above 3 Hz.

## Information architecture

Public routes under `/{locale}` (`en`, `pt`):

- `/` → negotiated 307 to a locale (cookie → `Accept-Language` → `en`).
- `/{locale}` Home: Hero → About (bio + up to 4 metrics) → Stack → Work (featured, max six) → Resume (Experience | Education tabs, PDF, LinkedIn) → Contact → Worth following. Nav: About · Stack · Work · Resume · Contact (D46, D48).
- `/{locale}/projects` (kind filter, 12 per page, crawlable `?page=`), `/{locale}/projects/{slug}` (gallery lightbox; known slugs prerendered; old slugs 308; unknown 404), `/{locale}/accessibility`, `/{locale}/resume` (307 to the PDF).
- `sitemap.xml`, `robots.txt`, `llms.txt`, manifest, icons, per-page OG images, `/api/terminal-content`, `/api/revalidate`.
- `/admin/**` gated; no link anywhere.

## Content and copy rules

- **Data policy.** All seed content is fictional (`isFixture`, `example.com`, invented companies, people and metrics). The only real facts are the owner's name, title and city (`src/config/site.ts`) and owner-supplied photos. Never present anything else as a real claim. No lorem ipsum or TODO in rendered text; no employer logos; the phone number is opt-in and never in metadata, structured data or the terminal.
- **Voice.** First person singular, confident, direct, warm; short sentences; concrete outcomes over adjectives; no "passionate", "rockstar", "guru", "ninja"; no emoji; sentence case; no exclamation marks.
- **English** is the source language; **Brazilian Portuguese** is written natively (natural syntax, first-person verbs, keep terms like deploy, backend, frontend, framework, pipeline, commit), never a literal translation. Every localized field exists in both languages (`i18n:check`).
- **Spelling.** Write "resume" without accents in copy, admin, docs, comments and tests (`scripts/spelling.test.ts` enforces it; `docs/archive/` is exempt).
- **Imagery.** The layout works without a profile photo (monogram) and without project covers (generated covers).
- Code, identifiers, comments, commit messages and docs are in English.

## Definition of done

- CI is green; Lighthouse accessibility/SEO = 100, axe zero violations, `check:seo` and `check:bundle` pass (performance at the documented floors, D58, D60).
- Every signature feature works on desktop and mobile, in both languages, and without JavaScript where specified.
- All content flows through the repository interface; the site works on fixtures and on a real Sanity dataset.
- The admin is invisible to anonymous visitors and crawlers; every admin write refreshes the affected public pages.
- No hard-coded public strings; no placeholder text; hidden items never reach HTML, sitemap, terminal or JSON-LD.
- Docs are current, and a project can be added from the admin by following [USAGE.md](./USAGE.md) alone.

## Hard don'ts

No invented real-world claims. No Sanity credentials, SDK or queries in client code; no secrets behind `NEXT_PUBLIC_`. No admin path in robots.txt, sitemap, public HTML, client bundles or catalogs; never 401/403/redirect for anonymous admin requests. No password in logs, history, storage, console or error reports. No `any`, `@ts-ignore` or unjustified disabled lint rules; no JavaScript sources. No React state updates per animation frame. No heavy dependency for something achievable in ~100 lines. No terminal, sphere or filter without reduced-motion and no-JS fallbacks. No committed build output or secrets.
