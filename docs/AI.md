# AI-assisted development

How AI agents built and maintain this repository, how to work with them, and the lessons worth carrying into the next iteration. Agent instructions themselves live in [AGENTS.md](../AGENTS.md) (the single source; `CLAUDE.md` imports it).

## History

| When               | What                                                                                                                                                                                                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-10-13         | Old portfolio cleared (`3637e7b`). The product and engineering spec ([archive/SPEC.md](./archive/SPEC.md)) was written as one implementation prompt for **Cursor, Agent mode, Claude Opus 5.5**, with a short kickoff ("read the spec, execute Phase 0, wait for my go").            |
| 2026-10-13         | **Phase 0** produced the first decision log (versions, caching, CSP, spec contradictions, risks). Later phases appended decisions in the same _context → decision → consequence_ format.                                                                                             |
| 2026-10-13 → 11-01 | **Phases 1–9** (foundation, data layer, public pages, tech cloud, window manager, terminal, auth, admin, hardening), each ending with a verification gate and a commit. Commits from 10-13 to 10-22 carry `Co-authored-by: Cursor` (14); the 10-26 → 10-28 commits carry no trailer. |
| 2026-11-01 → 11-02 | Hardening, accessibility and CI work, with `Co-Authored-By: Claude Opus 5.5` trailers (17 commits).                                                                                                                                                                                  |
| 2026-11-02 → 11-03 | Owner-driven polish (hero, header, tech cloud), analytics, auth fixes, dependency and CI work in **Claude Code** with `Co-Authored-By: Claude Sonnet 5.5` (32 commits). Next's dev server added the Next block to `AGENTS.md`.                                                       |
| 2026-11-03         | Manual **Claude PR review** workflow added to GitHub Actions.                                                                                                                                                                                                                        |
| 2026-11-12         | Claude workflows reworked: label-triggered issue → plan → PR pipeline, automatic labeled PR review (D78).                                                                                                                                                                            |
| 2026-11-04         | Documentation reorganized: `.cursor/rules/*` merged into `AGENTS.md`, `CLAUDE.md` added, `SPEC.md` archived, `DECISIONS.md` condensed, setup and usage guides rewritten.                                                                                                             |

Commit trailers are the audit trail for which tool wrote what: `git log --format='%h %s%n%b' | grep -iE 'co-authored'`.

## How agents are expected to work here

1. **Read first.** [AGENTS.md](../AGENTS.md) → [DECISIONS.md](./DECISIONS.md) for the area you touch → [ARCHITECTURE.md](./ARCHITECTURE.md). For any Next.js API, read `node_modules/next/dist/docs/` (the installed version postdates most training data; `middleware.ts`, single-arg `revalidateTag` and `unstable_cache` are deprecated; this repo uses `proxy.ts`, `updateTag`, root params).
2. **Verify, don't assume.** Run the gates in AGENTS.md; for UI/interaction work run the dev server and drive it with Playwright (screenshots at 375, 768, 1440 px). Never claim something works without having run it.
3. **Decide and document instead of asking**, unless truly blocked. Record non-obvious choices as the next `D<n>` under the right topic in DECISIONS.md; mark replaced ones superseded rather than deleting them.
4. **The owner's request beats the spec** (D37–D48, D67 all came from that). Record the override as a new decision and update the docs it touches.
5. **Small, conventional commits** (`feat(scope):`, `fix(scope):`, `docs:`, `ci:`…); never commit secrets or `.env*`; keep the Next-generated block in `AGENTS.md` (the dev server re-adds it).
6. **Docs are part of the change.** A behavior change updates the guide that describes it in the same commit (see the map in the README).

## Claude workflows (D78)

Both run `anthropics/claude-code-action` (SHA-pinned) and authenticate with the Claude subscription.

**One-time setup**

1. Install the [Claude GitHub App](https://github.com/apps/claude) on this repository (it authors Claude's PRs and comments, and its token is what lets a Claude PR trigger the review).
2. Locally run `claude setup-token` and copy the token it prints.
3. GitHub → repository → Settings → Secrets and variables → Actions → New repository secret: `CLAUDE_CODE_OAUTH_TOKEN`.
4. The labels `claude`, `claude:needs-input` and `claude:planned` (color `#d97757`) already exist; the workflows recreate any that goes missing.

Usage counts against the Claude subscription tied to the token. Rotate it like any secret (re-run `claude setup-token`, replace the repository secret).

### Issue to PR (`claude-issue.yml`)

1. The owner adds the **claude** label to an issue. The **planner** (Opus) reads the issue, the thread, `AGENTS.md` and the code. If a decision is genuinely the owner's, it posts numbered questions mentioning him, labels the issue `claude:needs-input` and stops.
2. The owner answers **in one comment**; that comment re-runs the same workflow and the planner resumes with the whole thread. Comments are ignored once the issue is no longer `claude:needs-input`.
3. With nothing open, the planner posts the plan as an issue comment (`<!-- claude:plan -->`, label `claude:planned`). The **implementer** (Sonnet) builds it from that comment on `claude/issue-<n>-<slug>` (cut from `next`), loops on the gates and commits (hooks stay on).
4. The workflow itself re-runs the gates (`lint`, `typecheck`, `test`, `i18n:check`, `icons:audit`, `build`, `check:bundle`, `check:seo`) and puts the results in the PR body. A short Claude step pushes and opens the PR against `next` with the App token: author `claude[bot]`, assignee the owner, label `claude` plus fitting existing labels, `Closes #<n>`. Any failing gate → draft PR.

To restart an issue from scratch, remove and re-add the **claude** label. Only the owner's label and comments trigger it.

### PR review (`claude-review.yml`)

- Every same-repo PR is assigned to the owner when opened.
- Claude (Sonnet) reviews when the PR is opened by the owner or `claude[bot]`, carries the **claude** label and is not a draft; adding the label later starts it too. New commits trigger a re-review limited to what changed.
- Each finding is an inline comment on the exact lines (one thread each), in Portuguese; the reviewer adds fitting existing labels and ends with one summary comment.

## Local agent settings

- `.claude/settings.local.json` holds personal Claude Code preferences (currently `"outputStyle": "Concise"`). It is ignored by a global gitignore rule and not part of the repo.
- Project-shared agent behavior goes in `AGENTS.md`/`CLAUDE.md` or a committed `.claude/settings.json`, never in the local file.
- `.cursor/rules/*.mdc` were removed; Cursor reads `AGENTS.md` natively.

## AI-related product facts

- Admin responses carry `X-Robots-Tag: noindex, nofollow, noarchive, nosniff…, noai, noimageai` (set in `src/proxy.ts`/`next.config.ts`; admin only on the allowed branch, API for `/api/**`).
- Technology category `ai` ("AI agents & tooling") lists Cursor, VS Code, Claude, GPT, Gemini and Lovable (D39).
- The terminal and admin do not call any AI service. There are no LLM calls in the app.

## Lessons for the next iteration

Things that cost time and are easy to repeat:

- **Cache Components looked right and was wrong** for this site: streamed `200`s break real 404/308 (D1b). Prove status codes against `next build && next start` before committing to a caching model.
- **React 19.3 rejects `<script>` created during client rendering**, including `next/script` (D21). Use `useServerInsertedHTML` from a client leaf.
- **zod v4 probes `new Function('')`**, a CSP violation, and bloats the client bundle: keep zod out of client code (D56).
- **Turbopack splits `@font-face`** into a render-blocking stylesheet when both layout and page import `styles/title-fonts.ts` (D67). Only the layout imports it.
- **`<html data-scroll-behavior="smooth">`** is required or card→detail transitions never form (D62).
- **Lighthouse under WSL** litters the repo with `C:\Users\…\lighthouse.*` and then breaks the Tailwind scanner (`rm -rf ./C:*`).
- **Playwright reuses a server on :3100**; kill stale ones by PID, never `pkill -f "next start"`.
- **Pin runners** (`ubuntu-24.04`): Playwright WebKit doesn't start on 26.04.
- **Peer ranges decide versions** (TypeScript 6.0, ESLint 9): `bun run update` restores both pins after a blanket upgrade.
- **Don't leak the admin through side channels**: headers set in `next.config` apply to anonymous 404s too (D51); multipart POSTs get Next's 400, not 404 (D54).
- **Performance targets in the original spec are unmet** (D58, D60). Decide deliberately before spending effort there; don't tighten the floors without a plan.
- **Fixture changes need a re-seed** (`sanity:seed --reset` on `development`), or technologies and categories drift between fixtures and Sanity (D39, SANITY.md).
