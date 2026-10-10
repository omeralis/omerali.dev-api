# Reviewed production project import

This supersedes the draft-only seeding policy in PHASE4.md. Schemas, frontend, database configuration and deployment pipelines are unchanged. All content access uses Strapi 5 Document Service; SQL is limited to PostgreSQL transaction/read-only/locking controls, never content inserts, updates or deletes.

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

This function uses Document Service reads in a read-only, repeatable-read PostgreSQL transaction. It checks all configured languages, draft/published versions, matching technologies and a database target fingerprint, writing only an inventory file. Do not start `strapi console` or call app.load() as part of a claimed zero-write dry-run: normal Strapi startup can synchronize schemas and write metadata. If an initialized runtime is unavailable, obtain inventory through authorized maintenance tooling first; no production-aware plan can honestly be produced without it.

```sh
node scripts/seed-projects.cjs --dry-run --inventory seed-review/inventory.json --out seed-review/plan.json
```

Review the ENTIRE plan, including existing drafts proposed for first publication, then preserve its digest. seed-review is ignored by Git; new files use mode 0600. Do not share editorial inventory publicly. Ambiguous technologies, duplicate documents, and existing shared fields/technology associations incompatible with the requested result block ALL writes. Existing translations are never rewritten. Missing locales receive only localized fields and inherit shared fields through Document Service. Existing published versions are never republished, even when their draft has changed.

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

After commit, the importer verifies /api/projects?locale=en and /api/projects?locale=ar with slug filters and populated technologies: documentId, locale, publication, featured flag, order and confirmed technology associations must match. Redirects are refused and tokens are never logged. Created/skipped/published events are printed after commit; failures state whether content committed.

An API failure after commit produces a nonzero exit. Never delete/recreate records: export fresh inventory, review a new plan, and retry. Matching existing versions are skipped. Stale/tampered plans, conflicts and absent backup evidence fail closed. The main script never retries writes automatically.

Tests: node --test tests/projects.test.cjs. In-memory tests cover proposal gating, bilingual creation/publication, idempotence, preserving an existing translation, conflicts/duplicates, stale/tampered plans, rollback and post-commit verification failure. Production locks/rollback, actual backup evidence and live API visibility remain unverified. No production writes were performed.

The current test suite has eight passing cases, including production backup-authorization refusal and API permission preflight refusal. API readability is checked before CLI application initialization and again before the content transaction. Live production verification is pending approval.

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
