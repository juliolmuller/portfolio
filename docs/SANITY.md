# Sanity

Sanity is the content store. The app talks to it only from the server, through `@/lib/content` (D25–D30). Setup order: [SETUP.md §4](./SETUP.md#4-sanity-one-time-shared-by-staging-and-production).

## Project and datasets

|               |                                                                          |
| ------------- | ------------------------------------------------------------------------ |
| Organization  | `ow3ahfjbr`                                                              |
| Project       | `njcnsmax`                                                               |
| `production`  | private; real content, written by the admin                              |
| `development` | private; fictional seed (`isFixture: true`), for local work and previews |

Both datasets are **private**: nothing is readable without a token, so hidden items (`visible: false`) and drafts never leak through the public API. No CORS origins are configured, because the browser never calls Sanity.

## Tokens

Create them in [sanity.io/manage](https://www.sanity.io/manage/project/njcnsmax) → API → Tokens. Paste each value straight into `.env.local` (locally) or the Vercel project settings, and never anywhere else.

| Variable             | Role   | Used by                         |
| -------------------- | ------ | ------------------------------- |
| `SANITY_READ_TOKEN`  | Viewer | public reads (`sanity/http.ts`) |
| `SANITY_WRITE_TOKEN` | Editor | admin writes, `sanity:seed`     |

Use one token pair per environment (local, preview, production) so a leaked token can be revoked alone. A Viewer token can read every dataset in the project. If previews must never read `production`, add a custom role scoped to `development`. Custom roles need an Enterprise plan; otherwise accept the risk.

```dotenv
CONTENT_SOURCE=sanity
SANITY_PROJECT_ID=njcnsmax
SANITY_DATASET=development
SANITY_API_VERSION=2026-10-01
SANITY_READ_TOKEN=…
SANITY_WRITE_TOKEN=…
```

## Reads

- `GET /v<apiVersion>/data/query/<dataset>` with `perspective=published`, no CDN (D8, D26). Next's fetch cache is the cache layer: every read carries `content:*` tags and `revalidate: 86400`.
- Queries live in `src/lib/content/sanity/queries.ts`. Projections rename storage fields to schema names; the shared pipeline validates with zod and skips invalid documents (logged with paths, never values).
- Images come back as `asset->{ url, metadata.dimensions, metadata.lqip }` plus `alt` and `hotspot`. `next/image` only allows `https://cdn.sanity.io/images/**`.

## Schema

`sanity/schema.ts` is the Studio-ready schema as plain data (D29). It is deployed to both datasets as the `default` workspace. After changing it:

1. `bun run test src/lib/content/sanity/schema.test.ts` (every field the converter writes must be declared);
2. `bun run sanity:schema` prints the declaration;
3. deploy it to `development` and `production` with Sanity's MCP `deploy_schema` (workspace `default`), or wire `schemaTypes` into a Studio and run `sanity schema deploy`.

### Skills (D93, epic #54)

The `skill` type is in the schema, previewed by English name and primary category. The public reader `getSkills` (tag `content:skills`) exists (#57) but no UI uses it, and there is no admin screen, although the admin actions already accept the type. The in-use check in `AdminService.remove` still covers only technologies until the `skillIds` links land (#83, #84). Owner steps:

1. Redeploy the `default` workspace schema to `development` now.
2. Redeploy it to `production` at release gate R1.
3. Add `"skill"` to the webhook `_type` filter (see "Revalidation webhook"). With `skill` in the filter, a skill change revalidates `content:skills`. `bun run content:smoke` now also reads skills; running it against `development` after the schema redeploy is optional but useful.

### Migration 2026-11 (D67)

Redeploy the schema, then for each dataset (`development`, then `production`):

- Profile: `unset: ["heroHeadline", "rotatingWords"]`. Set `heroLead` to a value of at most 120 characters in both languages (for example EN “I design and build web software, end to end.”, PT “Projeto e construo software web de ponta a ponta.”) when the current one is longer. Optionally set `titleFont` (one of the ids in `src/lib/content/taxonomy.ts`).
- Every `featuredLink` whose `placements` contains `"hero"`: set `placements` to the same array with `"hero"` replaced by `"header"` (the header shows at most three).
- Query `*[_type == "featuredLink" && "hero" in placements]` again: it must return nothing. Until then the reader skips those links and a profile with a longer lead.

### Running a Studio (optional)

The admin area is the intended editor. If you also want Sanity Studio, run it as a separate app; the repository ships what it needs in `sanity/studio.ts` (D65):

- `studioSchemaTypes`: `schemaTypes` plus list previews (English title, subtitle, image, and `· hidden` for `visible: false`), a "Display order" ordering for collections, and field validation that calls the app's zod schemas, so length limits, slug/URL/colour/date patterns, Markdown without raw HTML and "both English and Portuguese" rules match the admin exactly. Images need an uploaded asset and alt text in both languages.
- `singletonTypes`: `profile`, `contact` and `resume`, whose `_id` equals their type.

Cross-field and cross-document rules (unique slugs, existing technologies, an icon slug for Simple Icons/Devicon) are not repeated in Studio. A document that breaks them is skipped and logged by the read pipeline, so check the public page after publishing from Studio.

Scaffold the Studio next to (not inside) the app, for example `studio/` with its own `package.json` (`bun create sanity@latest`, then `bun add zod`), and keep the `sanity` package out of the app's dependencies:

```ts
// studio/sanity.config.ts
import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';

import { singletonTypes, studioSchemaTypes } from '../sanity/studio';

const singletons = new Set<string>(singletonTypes);

export default defineConfig({
  projectId: 'njcnsmax',
  dataset: 'development',
  plugins: [
    structureTool({
      structure: (S) =>
        S.list()
          .title('Content')
          .items([
            ...singletonTypes.map((type) =>
              S.listItem()
                .title(type)
                .id(type)
                .child(S.document().schemaType(type).documentId(type)),
            ),
            S.divider(),
            ...S.documentTypeListItems().filter((item) => !singletons.has(item.getId() ?? '')),
          ]),
    }),
  ],
  schema: {
    types: studioSchemaTypes,
    templates: (templates) => templates.filter((template) => !singletons.has(template.schemaType)),
  },
  document: {
    actions: (actions, { schemaType }) =>
      singletons.has(schemaType)
        ? actions.filter(({ action }) => action !== 'duplicate' && action !== 'delete')
        : actions,
  },
});
```

Notes for Studio editing:

- Studio creates drafts; the site reads `perspective=published`, so nothing shows until you publish. Publishing triggers the revalidation webhook below.
- New documents get Studio's random ids instead of `<type>.<uuid>`. The site reads them fine (ids only need to match `documentIdSchema`), but the admin's URLs assume `<type>.<uuid>` (D55), so it cannot open a Studio-created document. Create documents in the admin and edit them in either place.
- The Studio's own origin must be added under API → CORS origins with credentials, and editors sign in with their Sanity account; no app token is involved.

## Seeding

```sh
bun run sanity:seed --dry-run                 # convert only, no writes
bun run sanity:seed                           # SANITY_DATASET (development)
bun run sanity:seed --dataset development --reset
bun run sanity:seed --dataset production --force   # never for real content
```

- Writes the Appendix A fixtures (136 documents) in one `createOrReplace` transaction with stable ids, so re-running is idempotent.
- Uploads the 14 images and 2 PDFs from `public/fixtures`. Sanity deduplicates assets by content hash, and only `lqip` metadata is extracted.
- `--reset` deletes documents with `isFixture == true` only, after you type the dataset name in an interactive terminal.
- Refuses `production` without `--force`.

### Live smoke test

After seeding `development`, run `bun run content:smoke`. It reads every repository method in both locales from Sanity and from fixtures, and fails on any difference other than asset URLs, LQIPs and revision metadata, or on any content warning. The repository equality test proves the same offline against `groq-js` (D27); the live run covers the hosted GROQ engine, the auth header and the asset pipeline.

Last run, 2026-11-02, on `development`: `--reset` deleted 145 fixture documents (renamed technologies had left stale copies, e.g. `HTML5` next to `HTML`), then 136 documents and 16 assets were seeded; `content:smoke` passed, with all 24 reads matching. A plain re-seed never deletes, so use `--reset` after fixture ids change.

## Writes and revalidation

### Admin writes

The admin (`/admin`) is the editor: it writes through `src/lib/content/admin/` with `SANITY_WRITE_TOKEN` (an Editor token), documents are written already published, and every change calls `updateTag` for the affected `content:*` tags (D53).

### Revalidation webhook

Edits made outside the admin (Studio, the Sanity Manage UI) reach the site through `POST /api/revalidate`, which maps the document type to `content:*` tags (`tagsForDocument`) and calls `revalidateTag(tag, { expire: 0 })` (D9). After deploying:

1. In [sanity.io/manage](https://www.sanity.io/manage/project/njcnsmax) → API → Webhooks, add a webhook to `https://<your-domain>/api/revalidate`, method POST, dataset `production` (and one for `development` if previews matter; see [SETUP.md §6.7](./SETUP.md#67-staging-webhook-optional)).
2. Filter: `_type in ["profile","contact","resume","featuredLink","recommendedProfile","project","experience","education","technology","practice","skill"]`. Projection: `{_type, "slug": slug.current}`. Trigger on create, update and delete; drafts off.
3. Set a secret and put the same value in `SANITY_WEBHOOK_SECRET`. Anything unsigned, stale (over 10 minutes) or malformed gets a bare 404.

### Smoke run against a real dataset

`bun run admin:smoke` drives the real Sanity store and the admin service on the dataset in `.env.local`. It refuses `production`, needs `SANITY_WRITE_TOKEN`, and cleans up after itself:

- creates a practice and reads it back with an order and a revision;
- rejects a missing translation;
- updates with the loaded revision, then proves a stale revision is a conflict;
- hides it (a flag patch), reorders, and checks reference lookups;
- processes and uploads an image and checks the CDN metadata;
- deletes the practice.

Last run: `development`, all checks passed. Leftovers: the uploaded test image stays as an unreferenced asset (remove it in Manage → Media if you care), and the reorder renumbered the practices' `order` values (the relative order is unchanged; `sanity:seed --reset` restores the seed).

To try the UI itself, run the app with `CONTENT_SOURCE=sanity`, `SANITY_DATASET=development`, an admin password and `SESSION_SECRET`, sign in through the terminal, edit something, and confirm the change on the public page. Do not point it at `production` until you are ready to enter real content.
