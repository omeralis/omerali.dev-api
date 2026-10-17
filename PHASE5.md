# Editable bilingual portfolio

Global and About were empty in the audited production database and are safely
extended with localization and Draft & Publish. Global owns identity, career
start month, Hero, contact, social links and optional resume media. About owns
biography, details and skill groups referencing existing Technology documents.
Service and Experience are the only new collections. Existing Project/Technology
schemas and records are unchanged. Missing skill technologies are created; no
project technology relation is added. Career month precision and overlapping
employment dates are preserved. No unknown resume file, GitHub URL, email, logo
or company URL is invented.

Content API routes expose only find/findOne through standard Users & Permissions
authorization, always force published status and enabled records, and expose no
mutation routes. Configure only the six new public read scopes with the reviewed
`scripts/portfolio-permissions.cjs` operator (dry-run plan, exact digest and the
existing verified-backup gates). Existing permissions are preserved. Do not use
`auth:false`: it omits the Content API ability and causes Strapi's relation
sanitizer to strip skill Technology relations. Admin editing remains subject to
the existing Strapi admin authorization.

## Migration gates

The candidate snapshot is exported from the reviewed frontend commit recorded
in `scripts/portfolio-candidates.json`; it is migration input, never a frontend
fallback. SQL is limited to read-only inventory and transaction/locking controls.
All content creation, localization and publication uses Document Service APIs.

Deploy reviewed schemas first (after a recent backup/isolated restore check),
then use the deployed, compiled database configuration:

```sh
NODE_ENV=production node scripts/seed-portfolio.cjs --capture --out seed-review/phase5-inventory.json
node scripts/seed-portfolio.cjs --dry-run --inventory seed-review/phase5-inventory.json --out seed-review/phase5-plan.json
```

Capture uses a separate PostgreSQL connection, read-only repeatable-read
transaction, actual database identity, schemas, catalog columns/constraints,
all candidate/component/relation rows, projects and technologies, and locales.
It never starts Strapi. Read the full ignored inventory and mutation plan;
unknown/duplicate records, schema mismatch and missing locales block application.
Existing translations and drafts are never rewritten or published by a rerun.

The default plan creates fifteen documents, thirty bilingual versions and thirty
publications: one Global, one About, six Services, seven Experiences per locale.
It adds thirteen missing skill technologies while reusing Angular unchanged.

Verify a custom PostgreSQL backup by genuine restore into a private isolated
verification database/cluster, never production. The evidence format and
24-hour/checksum/target requirements are exactly those in SEEDING.md. Use the
same existing backup verifier, never infer restore success from archive listing.

```sh
NODE_ENV=production node scripts/seed-portfolio.cjs --apply \
  --plan seed-review/phase5-plan.json --confirm-plan EXACT_REVIEWED_DIGEST \
  --backup EXACT_VERIFIED_ARCHIVE --backup-evidence seed-review/phase5-backup-evidence.json \
  --confirm-backup-verified --confirm-production --publish \
  --api-url https://api.omerali.dev
```

The CLI verifies gates before Strapi startup. Startup may synchronize metadata;
it is not a read-only inventory operation. A serializable content transaction
locks all inventoried content/component/relation tables and repeats the full
inventory before mutations. It prepares all locales before publication, verifies
published identities, and proves project snapshots and existing technology rows
are unchanged before commit. Rollback on failure, sanitized stage diagnostics,
and no automatic write retries. Post-commit API failure is explicitly reported
as committed and requires inspection instead of retrying. Public API verification
checks both locales independently. For isolated integration tests, use `seed`
against an isolated PostgreSQL runtime, with genuine backup authorization.

Never commit seed-review files, backup evidence, database dumps or credentials.
Tests: `npm run test:projects`, `npm run test:portfolio`, `npx tsc --noEmit`,
`npm run build`.
