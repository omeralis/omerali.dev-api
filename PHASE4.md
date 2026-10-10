# Phase 4 operations

## What changed
Project and Technology collection types, project.feature / project.responsibility / project.seo components, read-only Content API routes, published-only Project controllers, catalog validation, generated types, and an optional draft seed script. Existing shared.seo, starter content, database config, upload config, workflows and VPS files are preserved. pg is declared explicitly for the existing PostgreSQL configuration.

## Before deployment (manual approval required)
Both main branches auto-deploy. Phase 4 is pushed to phase-4-projects branches only. Review before merging. Confirm a PostgreSQL backup and the actual DATABASE_CLIENT=postgres setup, credentials and driver installation; the checked-in config supports it but production credentials were not read or changed. Confirm the existing upload provider, public media origin, authorization to publish each screenshot, and durable public/uploads storage if using the default local provider. Neither storage persistence nor production database connectivity has been verified here.

After approval, deploy backend first using the existing process: install with npm ci, build with npm run build, then restart Strapi. Adding schemas requires a server restart and Strapi may synchronize schema on startup; this task does not start Strapi against a database or execute migrations. Do not reset/delete tables or existing content. Regenerate schema types after future model edits using npx strapi ts:generate-types.

## CMS configuration
1. Settings → Internationalization: ensure en and ar exist.
2. Use a custom read-only Content API token with only Project find/findOne and Technology find/findOne. Do not use an admin token. Public-role find/findOne is an alternative if intentionally public. Drafts cannot be read through these Project REST controllers. Create/update/delete API routes are not exposed.
3. Create English Project content, then add Arabic as a localization of the same document. Slug, type, year, status, media, featured/order, URLs and technologies are shared. Text, Blocks, features/responsibilities and SEO are localized. Slugs must be lowercase ASCII words separated by hyphens; keep the same slug across locales.
4. Review confidential information and authorized images before publication. Add descriptive alt text. Configure demo/repository URLs only for explicitly public, authorized resources. Private repository status cannot be inferred by the frontend.
5. Publish each reviewed locale. Flag at most the intended featured entries; frontend selects the first three by displayOrder then documentId. Unpublished locales return not-found.

## Optional draft candidates
node scripts/seed-projects.cjs is a dry run and does not load Strapi or connect to a database.
node scripts/seed-projects.cjs --apply is an explicit local/non-production operation against the configured database. Ensure it points to the intended local database before use; English and Arabic must already exist. The script skips any existing candidate slug, creates only incomplete drafts, links translations by documentId, reuses Angular and never publishes, overwrites, attaches arbitrary images or invents URLs, roles or metrics. Production invocation is disabled. No seed was applied during this task.

## Frontend and webhook
Set server-only STRAPI_API_URL=https://api.omerali.dev (legacy STRAPI_URL is supported), STRAPI_API_TOKEN to the read-only token, SITE_URL=https://omerali.dev, and STRAPI_MEDIA_ORIGIN only if media uses a separate public CDN origin. Tokens never enter browser code.
Set STRAPI_WEBHOOK_SECRET to at least 32 random characters. In Strapi Settings → Webhooks add https://omerali.dev/api/revalidate, header x-webhook-secret with the same secret, and entry create/update/publish/unpublish/delete events. Project/Technology events invalidate the global project cache, featured sections, both listings, dynamic detail paths and sitemap. Unauthenticated requests are rejected. A five-minute timed cache remains available without a webhook, including newly published slugs; no frontend rebuild is required.

API reads: GET /api/projects?locale=en|ar&status=published with explicit populate, filters, stable sort and pagination. Technology data is populated through Project relations (find permission required). No separate technology catalog request is needed by the frontend.

## Validation and current limitations
node --test tests/projects.test.cjs tests schemas and idempotent draft seeding without a database. Frontend has API-contract tests and fixture-only browser checks. The production /api/projects endpoint returned 404 before deployment. Live read-only credentials, real published translations/images, production PostgreSQL and persistent uploads are not available for end-to-end verification. Those checks remain incomplete until approved backend deployment and CMS configuration. Contact remains unchanged.

Validation results: Strapi 5.35 schema registration/type generation, standalone TypeScript, admin/server build, and two contract tests passed. No database startup, seeding or production migration was performed. Frontend fixture tests verified both locales, media, publication filtering and protected invalidation. Live production configuration remains incomplete.
