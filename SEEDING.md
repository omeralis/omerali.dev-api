# Reviewed production project import

This supersedes the draft-only seeding policy in PHASE4.md. Schemas, frontend, database configuration and deployment pipelines are unchanged. All content mutations use Strapi 5 Document Service. SQL is limited to inventory SELECTs and PostgreSQL transaction/read-only/locking controls, never content inserts, updates or deletes.

## Content and proposal

The three existing bilingual candidates retain stable slugs. New records have featured=true and orders 1, 2, 3. Both locales contain confirmed overview Blocks, short descriptions, features and neutral SEO. Angular is confirmed only for GRC. Other technologies, roles, responsibilities, business challenges/solutions, years, clients, images and external URLs cannot be populated without further confirmed information.

```sh
node scripts/seed-projects.cjs --dry-run --out seed-review/proposal.json
```

This never starts Strapi or connects to a database. Without inventory it prints a proposal-only plan: three missing documents, six missing locale versions, one proposed Angular record and six proposed publications. These are NOT observations of production. This plan is blocked from application.

## Database-aware inventory and review

Schemas must already be deployed and en/ar configured. Export inventory from an ALREADY INITIALIZED Strapi runtime using authorized operator tooling:

```js
await require('./scripts/seed-projects.cjs').captureInventory(strapi, 'seed-review/inventory.json');
```

This function uses Document Service reads in a read-only, repeatable-read PostgreSQL transaction. It checks all configured languages, draft/published versions, matching technologies and a database target fingerprint, writing only an inventory file. Do not start `strapi console` or call app.load() as part of a claimed zero-write dry-run: normal Strapi startup can synchronize schemas and write metadata.

### Read-only PostgreSQL alternative for an empty portfolio

When no initialized operator runtime is available, the existing importer also supports:

```sh
NODE_ENV=production node scripts/seed-projects.cjs --capture-postgres --out seed-review/inventory.json
node scripts/seed-projects.cjs --dry-run --inventory seed-review/inventory.json --out seed-review/plan.json
```

Capture loads only the existing compiled `dist/config/database.js` with Strapi's environment helper and the existing environment; it does not initialize Strapi. It opens a separate PostgreSQL connection, starts `REPEATABLE READ, READ ONLY`, reads actual catalog column types and foreign keys, verifies the connected database, reads all project/technology rows, both locales and technology/component links, then rolls back and closes. No DDL or data writes occur. No credentials are printed. Output is explicitly labeled `postgres-read-only`, with the configuration target fingerprint, source schema digest, deployed structure digest, raw snapshot digest and table counts.

This alternative has deliberately narrow equivalence: only empty projects, technologies, technology links and component links can authorize an import. SQL summaries of existing draft/published/localized records and technology relations are retained for conflict diagnosis, but cannot authorize publication or edits. Any existing content, orphan relationships, unknown mapping or missing locale blocks the plan and requires a complete Document Service capture. SQL summaries do not reconstruct components, media or Document Service middleware. Never relabel them as Document Service output.

For SQL plans, approved application reproduces the complete SQL snapshot inside the same serializable transaction and locks used for writes, compares every inventory field and digest, then independently confirms the empty candidate state, locales, schema and target through Document Service before the first mutation. Drift in content, relationships, columns, constraints, target or locale configuration aborts. After content exists, use the original initialized-runtime inventory method for idempotent reruns.

Source changes must first be reviewed on `phase-4-readonly-inventory`. A later approved deployment must place both updated script files on the server together; the existing deployment workflow builds the compiled configuration. Do not merge, trigger that workflow, or restart for preparation. An explicitly authorized one-off inventory operator invocation can run the reviewed JavaScript in memory over SSH using the existing configuration and schemas, writing only ignored inventory/plan artifacts; this is not an application deployment. Before subsequent approved application, deploy the revised importer through the normal reviewed process.

```sh
node scripts/seed-projects.cjs --dry-run --inventory seed-review/inventory.json --out seed-review/plan.json
```

Review the ENTIRE plan, including existing drafts proposed for first publication, then preserve its digest. seed-review is ignored by Git; new files use mode 0600. Do not share editorial inventory publicly. Ambiguous technologies, duplicate documents, and existing shared fields/technology associations incompatible with the requested result block ALL writes. Existing translations are never rewritten. Missing locales receive localized content, the stable slug and confirmed technology document identifiers explicitly; other shared fields inherit through Document Service. Strapi 5.35.0 treats UID attributes and relations as localized regardless of a false localized option, so they cannot be assumed to copy. Existing published versions are never republished, even when their draft has changed.

## Backup verification

Use existing PostgreSQL connection settings through secure PostgreSQL environment/credential mechanisms:

```sh
pg_dump --format=custom --file=seed-review/portfolio.dump
pg_restore --list seed-review/portfolio.dump
sha256sum seed-review/portfolio.dump
```

Restore-test the archive against an isolated verification target using the established operator backup procedure. The seeder never creates/restores/deletes databases. After that actual check, create seed-review/backup-evidence.json:

```json
{
  "sha256": "ACTUAL_ARCHIVE_SHA256",
  "target": "EXACT_plan.inventory.target_VALUE",
  "verifiedAt": "ACTUAL_RECENT_UTC_TIMESTAMP",
  "restoreTested": true
}
```

Evidence must match the streamed archive checksum and reviewed target, attest a real restore test and be no older than 24 hours. The script independently checks `pg_restore --list`; archive readability is not falsely treated as a successful restore test. PG_RESTORE_PATH can specify the installed executable. Restore evidence is an operator attestation, not an automatic claim by this script.

## Approved execution command — do not execute before review

Use the existing deployed API environment. If verification needs a read-only Content API token, supply STRAPI_READ_TOKEN securely. No environment files or database configuration are modified.

```sh
NODE_ENV=production node scripts/seed-projects.cjs --apply \
  --plan seed-review/plan.json \
  --confirm-plan EXACT_REVIEWED_PLAN_DIGEST \
  --backup seed-review/portfolio.dump \
  --backup-evidence seed-review/backup-evidence.json \
  --confirm-backup-verified \
  --confirm-production \
  --publish \
  --api-url https://api.omerali.dev
```

These flags require explicit operator approval. The CLI initializes Strapi only after all backup/review gates pass. Startup can run framework bootstrap; use already deployed matching schemas and the normal maintenance procedure, never this command to deploy schema changes. Framework startup is outside the seeder's content transaction.

The content transaction takes serializable PostgreSQL locks on projects/technologies with a 15-second lock timeout and rechecks the exact inventory. It creates missing technology/documents/localizations, prepares all six drafts, then publishes approved versions using documents(...).publish({documentId, locale}). Failures roll back all content mutations. No script delete method exists. Cooperating seeders and ordinary table writers are serialized by the locks.

## Verification and recovery

After commit, the importer verifies /api/projects?locale=en and /api/projects?locale=ar with slug filters and an explicit populate=technologies parameter: documentId, locale, publication, featured flag, order and confirmed technology associations must match. The same identity, slug and relation checks also run inside the transaction before commit. Redirects are refused and tokens are never logged. Created/skipped/published events are printed after commit; failures identify their stage and approved record label, whether content committed, and an allowlisted error name, PostgreSQL SQLSTATE code or validation field path. Raw messages, SQL, bindings, stacks, validation values and full records are never emitted. A failure at transaction commit reports that its outcome may be uncertain and requires inspection rather than automatic retries.

An API failure after commit produces a nonzero exit. Never delete/recreate records: export fresh inventory, review a new plan, and retry. Matching existing versions are skipped. Stale/tampered plans, conflicts and absent backup evidence fail closed. The main script never retries writes automatically.

Tests: npm run test:projects. In-memory tests cover proposal gating, bilingual creation/publication, idempotence, preserving an existing translation, conflicts/duplicates, stale/tampered plans, rollback, post-commit verification failure, read-only SQL transactions, inspected mappings, localizations, relations, database fingerprints and SQL/Document Service revalidation before writes. Tests do not claim production publication or rollback was executed.

API readability is checked before CLI application initialization and again before the content transaction. Live publication verification is pending subsequent explicit approval.

To avoid additional Strapi startup entirely, the approved application can also run in the same already initialized operator runtime used for inventory export:

```js
const importer = require('./scripts/seed-projects.cjs');
const plan = require('./seed-review/plan.json');
const authorization = await importer.verifyBackup(plan, 'seed-review/portfolio.dump', 'seed-review/backup-evidence.json');
await importer.seed(strapi, plan, {
  confirmPlan: 'EXACT_REVIEWED_PLAN_DIGEST',
  publish: true,
  confirmProduction: true,
  authorization,
  apiUrl: 'https://api.omerali.dev',
  apiToken: process.env.STRAPI_READ_TOKEN
});
```

This still requires explicit human approval, backup evidence and the reviewed digest. It does not call app.load() or perform framework bootstrap. Treat this initialized-runtime method as preferred when the operator must exclude framework startup writes entirely.
