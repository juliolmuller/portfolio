# Usage guide: signing in and editing the site

Everything on the public site except the UI labels (`messages/*.json`) and the owner's name, job title and city (`src/config/site.ts`) is edited in the **admin** at `/admin`. This guide is enough to update any page and add a portfolio item without reading the code. Setting up the password and secrets is in [SETUP.md](./SETUP.md#23-admin-optional).

## 1. Sign in

The admin has no login page and no link anywhere. It is reached through the terminal:

1. Open the site and press `Ctrl + /` (`Cmd + /` on a Mac), or click the **Terminal** button in the header (`>_`).
2. Type `su julio` and press Enter. A password prompt appears (nothing is echoed; pasting works; `Ctrl + C` cancels).
3. Enter the admin password. On success the terminal prints `Authenticated.` and the prompt turns red (`julio@…#`).
4. Type `admin` and press Enter. The dashboard opens.

Other secret commands: `logout` ends the session. They are invisible in `help` and completion.

**Session.** 30 minutes idle, 8 hours at most, renewed at most once a minute while you browse the admin, and every 10 minutes while an editor has unsaved changes. If saving or uploading finds the session gone, the message says so and your edits stay on the page: sign in again in another tab and retry. Two minutes before expiry a dialog offers **Stay signed in**. The header also has a **Sign out** button and a **View site** link.

**Where to sign in.** On whichever deployment you want to edit: local (`localhost:3000`), staging (`next-juliolmuller.vercel.app`, behind a Vercel login) or production (`juliolmuller.com`). Each has its own password and its own data ([SETUP.md](./SETUP.md#environments-at-a-glance)). Staging edits go to the `development` dataset; **production edits are live immediately**.

### If sign-in does not work

| Symptom                                          | Cause and fix                                                                                                                                        |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Authentication failure` with the right password | The admin is disabled: `SESSION_SECRET` (32+ characters) or the password / hash is missing or too weak. The server log names the variable once.      |
| Same failure after several wrong tries           | Lockout: 5 failures per 15 minutes lock the client for 15 minutes (doubling for repeat offenders); 30 failures per hour pause everyone. Wait it out. |
| `admin` prints "command not found"               | You are not signed in (or the session expired). Run `su julio` again.                                                                                |
| `/admin` shows the site's 404                    | Expected without a session: anonymous requests get the same 404 as any unknown URL.                                                                  |
| Dashboard says **Demo data, read-only**          | A production build running on fixtures. Connect Sanity (`CONTENT_SOURCE=sanity` and tokens) to edit real content.                                    |
| Saves fail with a read-only message              | `SANITY_WRITE_TOKEN` is missing (the admin fell back to the read token).                                                                             |
| Everyone got signed out                          | `SESSION_SECRET` was rotated, or the session hit the 8-hour cap.                                                                                     |

Every login answer takes at least 800 ms whether it succeeds or not; that is deliberate.

## 2. The admin at a glance

The **dashboard** shows counts of visible and hidden items per area, a **Needs attention** list, recent changes and two buttons (**Revalidate all public pages**, **Open public site**). **Needs attention** flags: missing Portuguese, images without alt text, project titles or summaries outside their length ranges, thin write-ups (under 150 words in a language) and more than six featured projects.

Areas (sidebar on desktop, tab bar on phones): **Profile, Links, Recommended, Projects, Experience, Education, Technologies, Practices, Contact, Résumé.**

How every area behaves:

- Lists have search, filters, a **Visible** toggle (and **Featured** for projects) and reordering by arrows or dragging the handle. Order is used on the public pages.
- Editors show localized fields side by side (EN | PT) from 1024 px and as tabs below. The **Copy** menu next to each field's badge copies English to Portuguese (or the reverse) as a starting point — rewrite it in natural Brazilian Portuguese. A badge warns when a translation is missing or identical to the English.
- **Save and publish** publishes at once and refreshes the affected public pages ("Published · public pages refreshed"). There are no drafts.
- Problems appear in a summary at the top that links to each field. Unsaved changes trigger a warning (it cannot intercept the browser's Back button).
- If someone saved a newer version, a dialog offers **Reload** or **Overwrite**.
- **Hide** (switch off Visible) is reversible and answers 404 on the public site; **Delete…** asks you to type the item's name and cannot be undone. A technology used by a project or job cannot be deleted.
- Images: JPEG, PNG, WebP or AVIF, **up to 4 MB** (Vercel's request limit), re-encoded and stripped of metadata. PDFs: up to 4 MB, checked for scripts. Custom icons are pasted as SVG and reduced to plain filled shapes.

## 3. Add a portfolio item

### Step 1: make sure its technologies exist

A project can only reference existing technologies. In **Technologies**, check that every tool it used is there. If one is missing: **New technology** → name, category, priority (1 and 2 appear everywhere; 3 is left out of the cloud on phones but stays in the List view), official site (optional). Icon: type in **Find a logo** (bundled catalogs first, then logos found by svgl, Iconify, Worldvectorlogo and, with a key, Logo.dev after a short pause; each row shows the source and variant; **Use a URL instead…** imports any public https SVG, PNG, WebP or AVIF; brand logos may be trademarked, so check the source); if online search says it is unavailable, use the options below. Or search the built-in sets (Simple Icons, Devicon), paste a single-colour SVG (strokes and transforms are refused; convert to filled shapes first), choose **Custom image** and upload a PNG/WebP with a transparent background (drawn as a single-colour silhouette), or leave empty for a two-letter monogram. **Save and publish**.

### Step 2: create the project

**Projects → New project.**

| Field                     | What to write                                                                                                         | Limits                                                 |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Title                     | The product's name, not a sentence                                                                                    | 80; aim for ≤ 60 (search results)                      |
| Tagline                   | One line on what it is                                                                                                | 90                                                     |
| Summary                   | Two sentences: the problem and the result. Also the meta description                                                  | 160; aim for 70–160                                    |
| Slug                      | Lowercase words with hyphens (`pay-bridge`); becomes the URL                                                          | Changing it later keeps the old URL working (308)      |
| Year                      | The year it shipped or started                                                                                        | 1990–2100                                              |
| Kind                      | web, mobile, desktop, automation, integration or open-source                                                          | Drives the filter on `/projects`                       |
| Status                    | live, in-progress, archived or private                                                                                | Shown as a badge                                       |
| My role                   | e.g. "Tech lead and backend"                                                                                          | 80                                                     |
| Featured                  | Shows on Home (the first six) and first on `/projects`                                                                | More than six raises a dashboard warning               |
| Visible on the site       | Off keeps it out of every page, the sitemap, the terminal and search engines                                          | Use it for drafts                                      |
| Context                   | The situation before you arrived                                                                                      | 1200                                                   |
| Approach                  | What you did and why                                                                                                  | 1200                                                   |
| Highlights                | 3 to 5 short, concrete outcomes ("Cut checkout errors by 40%")                                                        | 160 each                                               |
| Outcome (optional)        | Where it ended up                                                                                                     | 400                                                    |
| Full write-up (optional)  | Markdown: headings, lists, links, code, gallery pictures (`![alt](gallery:1)`). Raw HTML and scripts are removed      | Under 150 words per language is flagged as a thin page |
| Live URL / Repository URL | `https://` links only                                                                                                 | Live adds the "Visit app" button                       |
| Technologies              | Pick from the list (step 1)                                                                                           | Up to 24                                               |
| Cover image               | JPEG, PNG, WebP or AVIF ≤ 4 MB. Alt text in both languages is required. Set the focal point so crops keep the subject | Without a cover a generated one is used                |
| Gallery                   | Up to 12 images, each with alt text and an optional caption                                                           | Opens in the lightbox                                  |

Click **Save and publish**. The project is live at `/en/projects/<slug>` and `/pt/projects/<slug>`.

### Step 3: check it

1. Open both URLs. With Sanity the pages update at once; with demo data they can take a few seconds.
2. Check **Needs attention** on the dashboard.
3. In the terminal: `ls projects`, `open <slug>`.

### Order, hide, remove

Reorder in the list (arrows or drag); hide with **Visible**; delete from the item with **Delete…**.

## 4. Update page content by area

| Page section / area             | Edit in                         | Notes                                                                                                                                                                                                                                                                                          |
| ------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hero (name, lead, photo)        | **Profile**                     | The H1 is the display name. Lead ≤ 120 characters. Photo: square, plus an optional 3:4 for large screens. **Title font**: one of ten script fonts or Geist.                                                                                                                                    |
| About, metrics                  | **Profile**                     | Bio; up to 4 metrics shown as count-up tiles. Facts (location, languages, focus) show only in the terminal.                                                                                                                                                                                    |
| Header / footer / contact icons | **Links**                       | Choose where each link shows (header, footer, contact; the header shows three at most). "Own profile" adds `rel="me"` and feeds structured data.                                                                                                                                               |
| Stack (tech cloud + list)       | **Technologies**, **Practices** | Practices are text chips in the stack's List view.                                                                                                                                                                                                                                             |
| Selected work, `/projects`      | **Projects**                    | See §3. Featured projects (max six) appear on Home.                                                                                                                                                                                                                                            |
| Résumé timeline                 | **Experience**, **Education**   | Dated entries; current role has no end date and starts open. No employer logos. Location is optional. Role summaries over 400 characters are allowed (the counter warns) and show the first part with a "More" toggle. Technologies come from **Technologies** (add missing ones there first). |
| Résumé PDF buttons              | **Résumé**                      | One PDF per language, ≤ 4 MB, checked for scripts. Without a file the buttons hide and the terminal says it is not available yet.                                                                                                                                                              |
| Contact section                 | **Contact**                     | Email (shown obfuscated), phone (only when "show phone" is on, and never in metadata or the terminal), booking URL, call-to-action text.                                                                                                                                                       |
| Worth following                 | **Recommended**                 | People worth following; a note up to 140 characters. Hide every entry to hide the section.                                                                                                                                                                                                     |

Not editable in the admin (change the code and redeploy):

- UI labels, navigation, accessibility statement: `messages/en.json` and `messages/pt.json` (add every key to both).
- Owner name, job title, city: `src/config/site.ts`.
- To offer another title font: add its id/label in `src/lib/content/taxonomy.ts`, a loader call in `src/styles/title-fonts.ts`, and redeploy the Sanity schema.
- Section order and the schema itself.

## 5. Replacing the demo data (owner checklist)

The site launches with fictional demo data (flagged `isFixture`). Replace all of it:

- [ ] Profile: headline lead, bio, facts, metrics, portrait.
- [ ] Projects: real projects with covers, bilingual alt text and technologies. Delete or hide the demo ones (`orbit-dashboard`, `pocket-ledger`, `tidy-desk`, `invoice-bot`, `pay-bridge`, `lint-kit`, `scratch-pad`).
- [ ] Experience and education: real employers, roles, dates, outcomes.
- [ ] Links: real GitHub and LinkedIn URLs (flag them "own profile"); remove demo links.
- [ ] Recommended: real people, or hide the section.
- [ ] Contact: real email, booking URL, call to action; phone only if wanted.
- [ ] Résumé: PDFs in English and Portuguese.
- [ ] Technologies: confirm the mobile and desktop frameworks (none are seeded on purpose).
- [ ] After launch: Search Console / Bing verification ([SEO.md](./SEO.md)) and the Sanity webhook ([SANITY.md](./SANITY.md)).

## 6. Editing outside the admin

Content can also be edited in Sanity's Manage UI or an optional separate Studio ([SANITY.md](./SANITY.md#running-a-studio-optional)); those edits reach the site through the revalidation webhook. Documents created in Studio get random ids that the admin's URLs cannot open — create in the admin, edit in either.
