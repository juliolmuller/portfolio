# Setup guide

How to run the site locally and how to wire up every external service: **GitHub**, **Sanity** and **Vercel**. Each part can be followed on its own; the [checklists](#checklists) at the end summarize them.

Related: [USAGE.md](./USAGE.md) (signing in and editing content) · [SANITY.md](./SANITY.md) (datasets, tokens, webhook, seeding) · [ARCHITECTURE.md](./ARCHITECTURE.md) · [AI.md](./AI.md) (Claude workflows setup).

## Environments at a glance

|                           | Local                             | Staging (Vercel Preview)                       | Production (Vercel Production) |
| ------------------------- | --------------------------------- | ---------------------------------------------- | ------------------------------ |
| Git branch                | any                               | `next` (and every other non-production branch) | `main`                         |
| URL                       | `http://localhost:3000`           | `https://next-juliolmuller.vercel.app`         | `https://juliolmuller.com`     |
| Content                   | fixtures, or Sanity `development` | Sanity `development`                           | Sanity `production`            |
| Indexed by search         | no                                | no (`noindex` unless `VERCEL_ENV=production`)  | yes                            |
| HSTS and `__Host-` cookie | no (http)                         | yes (https site URL)                           | yes                            |
| Admin                     | optional                          | yes, own password and secret                   | yes, own password and secret   |
| Access                    | you                               | Vercel Authentication (Deployment Protection)  | public                         |

Rules that hold everywhere:

- **Each environment gets its own secrets**: Sanity tokens, `SESSION_SECRET`, admin password and webhook secret. A leaked value can then be revoked alone.
- **Only production writes to the `production` dataset.** Local work and previews use `development`. `admin:smoke` and `sanity:seed` refuse `production` (seeding needs `--force`).
- **`NEXT_PUBLIC_SITE_URL` and the security headers are fixed at build time.** After changing any variable in Vercel, redeploy.

## 1. Prerequisites

| Tool    | Version                              | Why                                              |
| ------- | ------------------------------------ | ------------------------------------------------ |
| Bun     | 1.4.x (`packageManager: bun@1.4.3`)  | package manager and the runtime for Next.js      |
| Node.js | 24.11+ and below 25 (`.nvmrc`: `24`) | ESLint, Vitest and Playwright                    |
| Git     | any recent version                   | Husky installs a pre-commit hook (`lint-staged`) |
| OpenSSL | any                                  | generating secrets (`openssl rand`)              |

Accounts: **GitHub** (repository `juliolmuller/portfolio`), **Sanity** (project `njcnsmax`, organization `ow3ahfjbr`), **Vercel**, and DNS access for `juliolmuller.com` (hosted at Hostinger, §6.6).

**Windows:** use WSL2 and keep the clone inside the Linux filesystem (`~/…`, not `/mnt/c/…`); Turbopack and file watching are much slower across the boundary.

## 2. Local development

### 2.1 Install

```sh
git clone git@github.com:juliolmuller/portfolio.git juliolmuller.com
cd juliolmuller.com
bun install            # also installs the Husky pre-commit hook
cp .env.example .env.local
```

### 2.2 Choose a content source

**A. Fixtures (no accounts needed).** Leave every Sanity variable empty. The site runs on the in-memory fictional demo data. The admin can sign in and edit in memory (changes vanish on restart); in a production build it is read-only.

**B. Sanity `development`.** For real content storage or to try admin writes. Create a **local** Viewer and Editor token ([SANITY.md → Tokens](./SANITY.md#tokens)) and set:

```dotenv
CONTENT_SOURCE=sanity
SANITY_PROJECT_ID=njcnsmax
SANITY_DATASET=development
SANITY_API_VERSION=2026-10-01
SANITY_READ_TOKEN=<local viewer token>
SANITY_WRITE_TOKEN=<local editor token>
```

If `development` is empty, seed it once with `bun run sanity:seed`. **Never** put `SANITY_DATASET=production` in `.env.local`.

### 2.3 Admin (optional)

```sh
openssl rand -base64 48                               # → SESSION_SECRET
bun run admin:hash "<a password of 16+ characters>"   # → ADMIN_PASSWORD_HASH
```

Put both in `.env.local` (a plain `ADMIN_PASSWORD` also works for a quick local try). Then press `Ctrl + /`, type `su julio`, enter the password, type `admin`. If either value is missing or weak, the admin stays disabled and the server logs a warning naming the variable. Full flow: [USAGE.md](./USAGE.md).

### 2.4 Logo search (optional)

The admin's **Find a logo** field searches public logo APIs from the server and lists only logos that downloaded and validated (D74). svgl, Iconify (`logos` set) and Worldvectorlogo need no key, so it works out of the box. Without network access it still lists the bundled catalogs and accepts a pasted URL. Put keys in `.env.local` only, never commit them.

- **Logo.dev (raster, optional):** sign up at [logo.dev](https://www.logo.dev) and copy the publishable key (`pk_…`) → `LOGODEV_PK`. The free plan requires attribution; the editor shows a credit whenever Logo.dev results are listed. The key stays on the server.
- **Worldvectorlogo (optional key):** without a key it allows 10 requests a day per IP; a free key from [worldvectorlogo.com/api](https://worldvectorlogo.com/api/docs/get-an-api-key) → `WORLDVECTORLOGO_KEY` raises that to 1,000 credits a month.
- **Choosing providers:** `LOGO_SEARCH_PROVIDERS` (comma-separated `svgl,iconify,worldvectorlogo,logo-dev`) limits the list; `none` disables online search (the e2e server does this). A failing provider is skipped; the editor says online search is unavailable only when all of them fail.
- **Formats:** SVGs that fit the path sanitizer are stored as paths; other SVGs (fill-rule, masks, gradients) and PNG/WebP/AVIF with transparency are stored as an image asset and drawn as a single-color silhouette (D75).
- **AI providers:** `AI_GATEWAY_*`, `OPENROUTER_*` and `AI_PROVIDER_ORDER` are kept for later work but no longer used by logo search.

### 2.5 Run

```sh
bun run dev                          # http://localhost:3000 → /en
bun run build && bun run start       # production build on port 3000
```

### 2.6 Verify like CI does

```sh
bun run lint && bun run typecheck
bun run test && bun run i18n:check && bun run icons:audit
bun run build && bun run check:bundle && bun run check:seo
bunx playwright install --with-deps chromium webkit firefox   # once
bun run test:e2e                     # needs the build; own server on :3100
bun run lhci                         # optional, slow
```

- The e2e server always uses fixtures and test credentials (`playwright.config.ts`), whatever `.env.local` says.
- Visual snapshots are skipped locally; run them with `VISUAL=1 bun run test:e2e visual.spec.ts`. Baselines are Linux PNGs.
- `test:e2e` reuses a server already listening on :3100. Stop stale ones by PID (`lsof -ti:3100`), not `pkill -f "next start"`.
- **Lighthouse under WSL** leaves `C:\Users\…\lighthouse.*` folders in the repo root. They are git-ignored, but the next build crashes until you delete them: `rm -rf ./C:*`.

## 3. Environment variables

All live in [.env.example](../.env.example) and are validated at boot by `src/env.ts` (names only in errors). Only `NEXT_PUBLIC_SITE_URL` is public. Local values go in `.env.local`; Vercel values go in the dashboard.

| Variable                                                                                                                             | Production                    | Preview                                | Purpose                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`                                                                                                               | `https://juliolmuller.com`    | `https://next-juliolmuller.vercel.app` | Canonical origin. An https URL also enables HSTS, `upgrade-insecure-requests` and the `__Host-` cookie                        |
| `CONTENT_SOURCE`                                                                                                                     | `sanity`                      | `sanity`                               | `sanity` or `fixtures`; inferred from the Sanity variables when empty                                                         |
| `SANITY_PROJECT_ID`                                                                                                                  | `njcnsmax`                    | `njcnsmax`                             |                                                                                                                               |
| `SANITY_DATASET`                                                                                                                     | `production`                  | `development`                          |                                                                                                                               |
| `SANITY_API_VERSION`                                                                                                                 | `2026-10-01`                  | `2026-10-01`                           | Pinned API date                                                                                                               |
| `SANITY_READ_TOKEN`                                                                                                                  | `production-read`             | `preview-read`                         | Viewer token for reads                                                                                                        |
| `SANITY_WRITE_TOKEN`                                                                                                                 | `production-write`            | `preview-write`                        | Editor token for admin writes and seeding                                                                                     |
| `SANITY_WEBHOOK_SECRET`                                                                                                              | own `openssl rand -hex 32`    | own (only with a staging webhook)      | Signs `POST /api/revalidate`                                                                                                  |
| `SESSION_SECRET`                                                                                                                     | own `openssl rand -base64 48` | own                                    | 32+ chars; rotating signs everyone out                                                                                        |
| `ADMIN_PASSWORD_HASH`                                                                                                                | `bun run admin:hash`          | a different password's hash            | Preferred over `ADMIN_PASSWORD` (16+ chars in production); the hash wins when both are set                                    |
| `GOOGLE_SITE_VERIFICATION`, `BING_SITE_VERIFICATION`                                                                                 | after launch                  | empty                                  | Search console ownership tags                                                                                                 |
| `ADMIN_FIXTURE_WRITES`                                                                                                               | **never**                     | **never**                              | E2E only: lets the admin write demo data in a production build                                                                |
| `LOGO_SEARCH_PROVIDERS`, `LOGODEV_PK`, `WORLDVECTORLOGO_KEY`                                                                         | empty                         | optional, keys **Sensitive**           | Logo search (§2.4); empty means svgl, Iconify and Worldvectorlogo without keys                                                |
| `AI_GATEWAY_API_KEY`, `AI_GATEWAY_MODEL`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `AI_PROVIDER_ORDER`, `LOGO_SEARCH_ALLOWED_HOSTS` | empty                         | optional, **Sensitive**                | AI providers, kept but unused by logo search (D74). `AI_GATEWAY_BASE_URL` and `OPENROUTER_BASE_URL` are for the e2e stub only |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`                                                                                 | empty                         | empty                                  | Reserved; the rate limiter is in memory (D51)                                                                                 |

`VERCEL_ENV` is set by Vercel and keeps previews `noindex`; never override it. Fill-in copies of the production and preview columns can be kept as `.env.production` / `.env.preview` in the repo root (git-ignored by `.env*`; Next.js loads them only in a matching `next build/start`, so treat them as scratch files and don't leave real secrets in them longer than needed).

## 4. Sanity (one-time, shared by staging and production)

Details in [SANITY.md](./SANITY.md). Summary:

1. **Datasets:** `development` and `production` exist and are both **private** (verified 2026-11-04). Add no CORS origins; the browser never calls Sanity.
2. **Schema:** deploy `sanity/schema.ts` to both datasets ([SANITY.md → Schema](./SANITY.md#schema)).
3. **Seed `development`:** `bun run sanity:seed`, then `bun run content:smoke`.
4. **Tokens:** a Viewer + Editor pair per environment, named so they can be told apart:

   | Token name                             | Role            | Goes into           |
   | -------------------------------------- | --------------- | ------------------- |
   | `local-read` / `local-write`           | Viewer / Editor | `.env.local`        |
   | `preview-read` / `preview-write`       | Viewer / Editor | Vercel → Preview    |
   | `production-read` / `production-write` | Viewer / Editor | Vercel → Production |

   A Viewer token can read every dataset in the project; restricting it needs an Enterprise custom role.

5. **Production content:** `production` starts empty and pages tolerate that (sections hide, default meta description). Enter real content through the admin on the production deployment (intended), or seed the demo data with `bun run sanity:seed --dataset production --force` and replace it item by item — only before any real content exists, because `--force` overwrites documents with the same ids.

## 5. GitHub

- **Repository:** `juliolmuller/portfolio`. Formerly `juliolmuller.github.io` (a GitHub Pages user site); hosting is Vercel (D11). Branches: `next` is the working/staging branch, `main` is production. `main` still holds the **old static portfolio** until the launch merge (§6.4). Remote branches today: `main`, `next` (plus a stale `master`).
- **CI** (`.github/workflows/ci.yml`): runs on **push** to `main` and `next` (not on pull requests): frozen install, format, lint, typecheck, unit tests, i18n and icon audits, build, `check:bundle`, `check:seo`, Playwright (Chromium, WebKit, mobile, Firefox smoke, visual), Lighthouse CI (reports as artifacts); `bun audit` runs as a separate job. It needs no secrets: it uses fixtures and test-only credentials. Runners are pinned to `ubuntu-24.04` (Playwright WebKit does not start on 26.04); bump together with Playwright. Actions are pinned to commit SHAs.

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:02d5066d3b1e45c1d0f2ef2fbfd9a49f2361126cdfd9e793eed05a75659f591c -->

- **Dependabot** (`.github/dependabot.yml`): grouped weekly version updates for Bun and GitHub Actions target `next`; security updates target the default branch, `main`. Keep the configuration on `main`, where Dependabot reads it. Review release notes for the `framework` group (Next.js + React together).

<!-- /coderabbit-ai-generated:v1 -->

- **Visual baselines** (`visual-baselines.yml`, manual): Actions → _Visual baselines_ → Run workflow, download the artifact and commit the PNGs under `tests/e2e/__screenshots__/`.
- **PR author assignment** (`pr-author-assign.yml`): on `pull_request_target` (`opened`, `reopened`) it assigns the PR author as assignee with `toshimaru/auto-author-assign` (pinned to a commit SHA). It needs no secrets and only `pull-requests: write`; it never checks out PR code.
- **Claude issue to PR** (`claude-issue.yml`) and **Claude PR review** (`claude-review.yml`): label-triggered (`Claude` → `main`, `claude:next` → `next`); need the Claude GitHub App and the `CLAUDE_CODE_OAUTH_TOKEN` repository secret. Flow and setup in [AI.md](./AI.md#claude-workflows-d78).
- **GitHub Pages:** while `main` is the old site, Pages serves it. See §6.4 for what to do at launch.
- **Husky** runs `lint-staged` (ESLint with `--max-warnings=0`, Prettier) before each commit.

## 6. Vercel

### 6.1 Create and link (one-time)

1. **Add New → Project**, import `juliolmuller/portfolio` into the account that should own it (a personal portfolio usually belongs on the personal Hobby account).
2. Build settings:

   | Setting          | Value                                               |
   | ---------------- | --------------------------------------------------- |
   | Framework preset | Next.js                                             |
   | Root directory   | `./`                                                |
   | Install command  | from `vercel.json`: `bun install --frozen-lockfile` |
   | Build command    | default (`bun run build`)                           |
   | Node.js version  | 24.x                                                |
   | Bun runtime      | from `vercel.json`: `bunVersion: "1.4.x"`           |

3. **Settings → Git:** production branch `main`; every other branch (including `next`) deploys as a Preview.
4. **Settings → Deployment Protection:** keep **Vercel Authentication** on (Standard Protection): previews, including staging, need a Vercel login; production stays public.
5. Set the environment variables (§6.2) _before_ the first real deployment, or expect to redeploy once.
6. **Enable Web Analytics** in the project (Analytics tab). The script is served only on Vercel deployments, cookieless, from `/_vercel/insights` (D68).

### 6.2 Environment variables

**Settings → Environment Variables**, using the table in §3. Mark every value except `NEXT_PUBLIC_SITE_URL` as **Sensitive**; leave "Development" unchecked (local work reads `.env.local`).

- Without `NEXT_PUBLIC_SITE_URL`, previews fall back to `http://localhost:3000`: canonicals and `og:image` point to localhost and HSTS / `__Host-` cookie are off. Setting the Preview value to the staging URL fixes it for every branch (feature-branch previews then point to staging; harmless, previews are never indexed).
- `ADMIN_PASSWORD_HASH` has no `$` characters (`scrypt:N:r:p:salt:hash`), so shells and env files don't mangle it.
- The build reads Sanity. A wrong token or dataset fails the build loudly by design; the previous deployment stays live.

### 6.3 Domains

Production uses the custom domain `juliolmuller.com` (DNS setup in [§6.6](#66-custom-domain)). Staging stays on a free one-level `*.vercel.app` name (certificates don't cover `a.b.vercel.app`), so it needs no DNS.

1. **Production:** **Settings → Domains**, `juliolmuller.com` serves Production (no redirect). `www.juliolmuller.com` and every other `*.vercel.app` alias, including the former production URL `juliolmuller.vercel.app`, redirect to it (308). `lacus.solutions` and `www.lacus.solutions` also redirect to it (307).
2. **Staging:** add `next-juliolmuller.vercel.app` and set **Git branch: `next`**, with no redirect. Every push to `next` updates staging.
3. Redeploy `next` so the build picks up the Preview variables.

### 6.4 Production launch (one-time)

**Read first.** `main` still holds the old static site served by GitHub Pages. Merging `next` into `main` makes Pages rebuild from the Next.js source and breaks the old portfolio.

Before the merge:

1. CI on `next` is green, including the `audit` job. (The earlier Next.js 16.4.0 advisories were fixed by upgrading; re-check `bun audit` anyway.)
2. Check staging: both locales, sign in to the admin, edit something in `development` and see it on the page.
3. Keep the old site up (skip if you no longer need it, and turn Pages off instead):

   ```sh
   git push origin origin/main:refs/heads/legacy-pages
   ```

   Then **GitHub → Settings → Pages → Build and deployment → Deploy from a branch → `legacy-pages` / root**.

Launch:

1. Merge `next` into `main` (PR, CI green). Vercel builds production at `https://juliolmuller.com`.
2. Open it in a private window: it must load **without** a Vercel login. If it asks for one, make the production domain public in Deployment Protection.
3. Sign in to the admin there and enter real content (replace any demo data).
4. Configure the production Sanity webhook ([SANITY.md → Webhook](./SANITY.md#revalidation-webhook)).
5. Remote SEO crawl (empty `SESSION_SECRET` skips the admin check, which needs the production secret):

   ```sh
   SESSION_SECRET= SEO_BASE_URL=https://juliolmuller.com bun run check:seo
   ```

6. `curl -sI https://juliolmuller.com/en` must show `strict-transport-security`, `content-security-policy` and no `x-robots-tag`; any preview URL must carry `noindex`.
7. Work through [SEO.md](./SEO.md) (Search Console URL-prefix property verified with the HTML tag, Bing, sitemap) and the manual screen-reader pass in [ACCESSIBILITY.md](./ACCESSIBILITY.md).

### 6.5 Rolling back

- **Code:** Vercel → Deployments → pick an earlier production deployment → **Instant Rollback**. Content is unaffected.
- **Content:** Sanity keeps document history (Manage → document history), or re-save the old values in the admin.
- **Old portfolio:** keeps running from `legacy-pages` until you turn Pages off.

### 6.6 Custom domain

`juliolmuller.com` is the production domain (D70). Canonical URL, sitemap, Open Graph and HSTS all follow `NEXT_PUBLIC_SITE_URL`, so attaching or changing a domain is configuration plus a redeploy:

1. A day ahead, lower the domain's DNS TTL to 300 s.
2. In GitHub → Settings → Pages, remove the custom domain if Pages still claims it.
3. Vercel → Domains: add `juliolmuller.com`, plus `www` redirecting to the apex (308). Create the DNS records Vercel lists under **View DNS configuration** (currently `A @ 216.198.79.1` and a per-project `CNAME www` ending in `.vercel-dns-017.com`; the legacy `76.76.21.21` and `cname.vercel-dns.com` keep working) and wait for the certificate.
4. Set Production `NEXT_PUBLIC_SITE_URL=https://juliolmuller.com` and **redeploy**.
5. Redirect `juliolmuller.vercel.app` → `juliolmuller.com` (308).
6. Re-point the Sanity webhook, add the new property in Search Console and Bing, submit the new sitemap.
7. When stable, turn GitHub Pages off and raise the TTL.

### 6.7 Staging webhook (optional)

Admin edits on staging already refresh staging. A `development` webhook only matters for edits made outside the admin. Because Deployment Protection blocks unauthenticated requests: create a **Protection Bypass for Automation** secret in Vercel, then add a second Sanity webhook to `https://next-juliolmuller.vercel.app/api/revalidate` (dataset `development`, header `x-vercel-protection-bypass: <secret>`, the Preview `SANITY_WEBHOOK_SECRET`).

## 7. Ongoing operations

| Task                        | How                                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------------- |
| Ship a change               | Branch from `next`, PR to `next` (preview build; CI runs on the push), merge `next` → `main` to release |
| Dependency updates          | Dependabot PRs on Mondays                                                                               |
| Rotate the admin password   | `bun run admin:hash`, update `ADMIN_PASSWORD_HASH` in Vercel, redeploy                                  |
| Sign everyone out           | Change `SESSION_SECRET`, redeploy                                                                       |
| Rotate a Sanity token       | Create the new token, update Vercel, redeploy, then delete the old token                                |
| Change the Sanity schema    | See [SANITY.md → Schema](./SANITY.md#schema)                                                            |
| Regenerate visual baselines | Actions → _Visual baselines_                                                                            |
| Debug production            | Vercel → Deployments → Runtime Logs. Content warnings log document paths, never values                  |

Self-hosting works with `bun run build && bun run start` behind a reverse proxy that terminates TLS, compresses responses and **overwrites** `X-Forwarded-For` (the login rate limiter trusts its first entry). If the proxy rewrites the host, set `serverActions.allowedOrigins`.

## Checklists

**Local**

- [ ] Bun 1.4 and Node 24 installed; clone inside WSL's filesystem on Windows
- [ ] `bun install`, `.env.local` from `.env.example`
- [ ] Content: fixtures (empty Sanity variables), or `development` with local tokens
- [ ] Optional admin: `SESSION_SECRET` and `ADMIN_PASSWORD_HASH`
- [ ] `bun run dev` serves `/en` and `/pt`

**Staging**

- [ ] Vercel project imported, production branch `main`, Node 24.x, Vercel Authentication on
- [ ] Preview variables set (dataset `development`, preview tokens, own secrets)
- [ ] `next-juliolmuller.vercel.app` assigned to branch `next`; redeployed
- [ ] Admin works; pages carry `noindex`

**Production**

- [ ] Production variables set (dataset `production`, production tokens, own secrets)
- [ ] `juliolmuller.com` serves Production; `www.juliolmuller.com` and `juliolmuller.vercel.app` redirect to it (308)
- [ ] `main` copied to `legacy-pages` and Pages pointed at it (or Pages off)
- [ ] CI green incl. `audit`; `next` merged into `main`; production build succeeded
- [ ] Loads without a Vercel login; Web Analytics enabled
- [ ] Real content entered; demo data gone
- [ ] Sanity webhook for `production`
- [ ] `check:seo` against the live URL; headers checked
- [ ] SEO and accessibility launch checklists done
