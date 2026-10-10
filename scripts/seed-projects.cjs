'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { candidates, technologies } = require('./project-candidates.cjs');
class SeedError extends Error {}
const backupAuthorizations = new WeakSet();
const PROJECT = 'api::project.project';
const TECHNOLOGY = 'api::technology.technology';
const locales = ['en', 'ar'];
const populate = { technologies: true, features: true, responsibilities: true, coverImage: true, gallery: true, seo: { populate: { ogImage: true } } };
function canonical(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
const digest = value => crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const schemaDigest = () => digest([PROJECT, TECHNOLOGY].map(uid => {
  const type = uid.split('::')[1].split('.')[0];
  return JSON.parse(fs.readFileSync(path.join(__dirname, `../src/api/${type}/content-types/${type}/schema.json`), 'utf8'));
}));
function targetFingerprint(strapi) {
  const database = strapi.config.get('database.connection');
  if (database.client !== 'postgres') throw new SeedError('This production importer requires PostgreSQL.');
  const connection = database.connection;
  const url = connection.connectionString ? new URL(connection.connectionString) : null;
  return digest({ client: 'postgres', host: url?.hostname || connection.host, port: url?.port || connection.port || 5432, database: url?.pathname.slice(1) || connection.database, schema: connection.schema || 'public' });
}
async function readInventory(strapi) {
  const configured = (await strapi.plugin('i18n').service('locales').find()).map(locale => locale.code).sort();
  if (!locales.every(locale => configured.includes(locale))) throw new SeedError('Configure en and ar before planning.');
  const records = [];
  for (const candidate of candidates) for (const locale of configured) for (const status of ['draft', 'published']) {
    const rows = await strapi.documents(PROJECT).findMany({ filters: { slug: candidate.slug }, locale, status, populate, limit: 100 });
    if (rows.length >= 100) throw new SeedError('Inventory limit reached; manual inspection required.');
    records.push(...rows.map(record => ({ status, record })));
  }
  const catalog = await strapi.documents(TECHNOLOGY).findMany({ filters: { $or: technologies.flatMap(t => [{ slug: t.slug }, { name: { $eqi: t.name } }]) }, limit: 100 });
  if (catalog.length >= 100) throw new SeedError('Technology inventory limit reached.');
  records.sort((a,b) => `${a.record.slug}:${a.record.locale}:${a.status}:${a.record.documentId}`.localeCompare(`${b.record.slug}:${b.record.locale}:${b.status}:${b.record.documentId}`));
  catalog.sort((a,b) => a.documentId.localeCompare(b.documentId));
  return { source: 'document-service', target: targetFingerprint(strapi), schema: schemaDigest(), locales: configured, records, technologies: catalog };
}
// Invoke inside an ALREADY INITIALIZED Strapi runtime. Never bootstrap Strapi to do a dry run.
async function captureInventory(strapi, file) {
  const inventory = await strapi.db.transaction(async ({ trx }) => {
    await trx.raw('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
    return readInventory(strapi);
  });
  save(file, inventory);
  return inventory;
}
function localizedData(candidate, locale) {
  const value = candidate[locale];
  return { title: value.title, shortDescription: value.shortDescription, description: value.description, features: value.features.map((title, index) => ({ title, displayOrder: index + 1 })), seo: value.seo };
}
function buildPlan(inventory) {
  const conflicts = [];
  if (inventory.source !== 'document-service' || !inventory.target) conflicts.push('Production inventory is required; this is a proposal only.');
  if (inventory.schema !== schemaDigest()) conflicts.push('Inventory schema does not match this importer.');
  const catalog = technologies.map(technology => {
    const matches = inventory.technologies.filter(t => t.slug === technology.slug || t.name.toLowerCase() === technology.name.toLowerCase());
    if (matches.length > 1 || matches.some(t => t.name.toLowerCase() !== technology.name.toLowerCase())) conflicts.push(`Ambiguous technology: ${technology.slug}`);
    return { ...technology, action: matches.length ? 'reuse' : 'create', documentId: matches[0]?.documentId };
  });
  const projects = candidates.map(candidate => {
    const rows = inventory.records.filter(row => row.record.slug === candidate.slug);
    const identifiers = [...new Set(rows.map(row => row.record.documentId))];
    if (identifiers.length > 1) conflicts.push(`Multiple documents share slug ${candidate.slug}.`);
    for (const { record } of rows) {
      if (record.featured !== true || record.displayOrder !== candidate.displayOrder || record.projectType !== candidate.projectType) conflicts.push(`Existing shared fields conflict: ${candidate.slug}/${record.locale}. No overwrite permitted.`);
      for (const slug of candidate.technologies) {
        const expected = catalog.find(t => t.slug === slug)?.documentId;
        if (!expected || !record.technologies?.some(t => t.documentId === expected)) conflicts.push(`Existing technology relation conflicts: ${candidate.slug}/${record.locale}.`);
      }
    }
    const versions = locales.map(locale => {
      const draft = rows.filter(row => row.status === 'draft' && row.record.locale === locale);
      const published = rows.filter(row => row.status === 'published' && row.record.locale === locale);
      if (draft.length > 1 || published.length > 1) conflicts.push(`Duplicate locale version: ${candidate.slug}/${locale}.`);
      const existing = draft[0]?.record || published[0]?.record;
      return { locale, action: existing ? 'skip-existing' : 'create-missing', publish: published.length ? 'skip-published' : 'publish-reviewed', content: existing || localizedData(candidate, locale) };
    });
    return { slug: candidate.slug, documentId: identifiers[0], projectType: candidate.projectType, featured: true, displayOrder: candidate.displayOrder, technologies: candidate.technologies, versions };
  });
  const plan = { format: 1, inventory, catalog, projects, conflicts: [...new Set(conflicts)], notices: ['Unknown roles, responsibilities, years, clients, URLs, screenshots and unconfirmed technologies remain unspecified.', 'Existing translations and published versions are never overwritten.', 'Applying requires the exact plan digest and verified database backup evidence.'] };
  return { ...plan, digest: digest(plan) };
}
function save(file, value) {
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
}
function validatePlan(plan, confirmation) {
  const { digest: hash, ...body } = plan;
  if (hash !== digest(body) || hash !== confirmation) throw new SeedError('Plan review digest is missing or does not match.');
  if (plan.conflicts.length) throw new SeedError(`Plan is blocked: ${plan.conflicts.join(' ')}`);
  if (plan.inventory.source !== 'document-service') throw new SeedError('A database-aware inventory is required.');
  if (digest(buildPlan(plan.inventory)) !== digest(plan)) throw new SeedError('Candidate content changed since review; regenerate the plan.');
}
async function verifyBackup(plan, file, evidenceFile) {
  const evidence = JSON.parse(fs.readFileSync(evidenceFile, 'utf8'));
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  const checksum = hash.digest('hex');
  if (evidence.sha256 !== checksum || evidence.target !== plan.inventory.target || evidence.restoreTested !== true || !Number.isFinite(Date.parse(evidence.verifiedAt)) || Date.now() - Date.parse(evidence.verifiedAt) > 86400000 || Date.parse(evidence.verifiedAt) > Date.now()) throw new SeedError('Backup evidence must match the file/target and attest a restore test within 24 hours.');
  const check = spawnSync(process.env.PG_RESTORE_PATH || 'pg_restore', ['--list', file], { encoding: 'utf8' });
  if (check.error || check.status !== 0 || !check.stdout.includes('dbname:')) throw new SeedError('Backup must be a readable PostgreSQL custom/tar archive verified by pg_restore --list.');
  // Restore verification is an operator attestation, not inferred from archive readability.
  const authorization = { checksum, target: plan.inventory.target };
  backupAuthorizations.add(authorization);
  return authorization;
}
function apiBase(base) {
  const url = new URL(base);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || (process.env.NODE_ENV === 'production' && url.protocol !== 'https:')) throw new SeedError('Invalid or insecure API URL.');
  return url;
}
async function ensureApiReadable(base, token, fetcher = fetch) {
  for (const locale of locales) {
    const endpoint = new URL('/api/projects', apiBase(base));
    endpoint.search = new URLSearchParams({ locale, 'pagination[pageSize]': '1' }).toString();
    const response = await fetcher(endpoint, { headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: AbortSignal.timeout(10000), redirect: 'error' });
    if (!response.ok || !Array.isArray((await response.json()).data)) throw new SeedError(`API read permission/connectivity preflight failed: ${locale}.`);
  }
}
async function verifyApi(plan, ids, base, token, fetcher = fetch) {
  const url = new URL(base);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new SeedError('Invalid API URL.');
  const verified = [];
  for (const locale of locales) for (const project of plan.projects) {
    const endpoint = new URL('/api/projects', url);
    endpoint.search = new URLSearchParams({ locale, 'filters[slug][$eq]': project.slug }).toString();
    let success = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await fetcher(endpoint, { headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: AbortSignal.timeout(10000), redirect: 'error' });
      if (response.ok) {
        const body = await response.json();
        success = Array.isArray(body.data) && body.data.length === 1 && body.data[0].documentId === ids[project.slug] && body.data[0].locale === locale && !!body.data[0].publishedAt && body.data[0].featured === true && body.data[0].displayOrder === project.displayOrder && project.technologies.every(slug => body.data[0].technologies?.some(technology => technology.name === technologies.find(t => t.slug === slug).name));
      }
      if (success) break;
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 500));
    }
    if (!success) throw new SeedError(`API verification failed: ${project.slug}/${locale}. Committed records must not be re-created; inspect and rerun verification.`);
    verified.push(`${project.slug}/${locale}`);
  }
  return verified;
}
async function seed(strapi, plan, options) {
  validatePlan(plan, options.confirmPlan);
  if (options.publish !== true) throw new SeedError('Explicit publication confirmation is required.');
  if ((process.env.NODE_ENV === 'production' || strapi.config.get('environment') === 'production') && (!options.confirmProduction || !backupAuthorizations.has(options.authorization) || options.authorization.target !== plan.inventory.target)) throw new SeedError('Verified backup authorization and production confirmation are required.');
  await ensureApiReadable(options.apiUrl, options.apiToken, options.fetcher);
  const events = [], ids = {};
  let committed = false;
  try {
    await strapi.db.transaction(async ({ trx }) => {
      // PostgreSQL transaction control only; all content access uses Document Service.
      // Serialize cooperating seeders before taking the current inventory snapshot.
      await trx.raw('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
      await trx.raw("SET LOCAL lock_timeout = '15s'");
      const schema = strapi.config.get('database.connection.connection.schema') || 'public';
      await trx.raw('LOCK TABLE ??, ?? IN SHARE ROW EXCLUSIVE MODE', [schema + '.projects', schema + '.technologies']);
      const current = await readInventory(strapi);
      if (digest(current) !== digest(plan.inventory)) throw new SeedError('Database changed since dry-run review. Regenerate the plan; no content was written.');
      const technologyIds = {};
      for (const item of plan.catalog) {
        const record = item.documentId ? { documentId: item.documentId } : await strapi.documents(TECHNOLOGY).create({ data: { name: item.name, slug: item.slug, category: item.category, displayOrder: item.displayOrder } });
        technologyIds[item.slug] = record.documentId;
        events.push({ status: item.documentId ? 'skipped' : 'created', record: `technology:${item.slug}`, documentId: record.documentId });
      }
      for (const project of plan.projects) {
        const candidate = candidates.find(c => c.slug === project.slug);
        let documentId = project.documentId;
        for (const version of project.versions) {
          if (version.action === 'skip-existing') { events.push({ status: 'skipped', record: `${project.slug}/${version.locale}`, documentId }); continue; }
          const data = localizedData(candidate, version.locale);
          const record = documentId
            ? await strapi.documents(PROJECT).update({ documentId, locale: version.locale, status: 'draft', data })
            : await strapi.documents(PROJECT).create({ locale: version.locale, status: 'draft', data: { ...data, slug: project.slug, projectType: project.projectType, featured: true, displayOrder: project.displayOrder, technologies: project.technologies.map(slug => technologyIds[slug]) } });
          if (documentId && record.documentId !== documentId) throw new SeedError('Localization document identifier mismatch.');
          documentId = record.documentId;
          events.push({ status: 'created', record: `${project.slug}/${version.locale}`, documentId });
        }
        ids[project.slug] = documentId;
      }
      // All six drafts exist before the first publication. Never republish an existing published version.
      for (const project of plan.projects) for (const version of project.versions) {
        if (version.publish === 'skip-published') { events.push({ status: 'skipped', record: `published:${project.slug}/${version.locale}`, documentId: ids[project.slug] }); continue; }
        await strapi.documents(PROJECT).publish({ documentId: ids[project.slug], locale: version.locale });
        const record = await strapi.documents(PROJECT).findOne({ documentId: ids[project.slug], locale: version.locale, status: 'published', populate });
        if (!record || !record.publishedAt || record.featured !== true || record.displayOrder !== project.displayOrder) throw new SeedError(`Publication verification failed: ${project.slug}/${version.locale}`);
        events.push({ status: 'published', record: `${project.slug}/${version.locale}`, documentId: record.documentId });
      }
    });
    committed = true;
    events.forEach(event => console.log(JSON.stringify(event)));
    const verified = await verifyApi(plan, ids, options.apiUrl, options.apiToken, options.fetcher);
    console.log(JSON.stringify({ status: 'verified', records: verified }));
    return { events, ids, verified };
  } catch (error) {
    console.error(JSON.stringify({ status: 'failed', committed, records: plan.projects.map(p => p.slug), message: error instanceof SeedError ? error.message : 'Document Service or API operation failed; inspect the operator logs without exposing credentials.', recovery: committed ? 'Content is committed. Review a fresh dry-run and retry; existing records will be skipped.' : 'Content transaction rolled back. Regenerate the plan before retrying.' }));
    throw error;
  }
}
async function main(args) {
  if (args.includes('--apply') && args.includes('--dry-run')) throw new SeedError('Dry-run and apply modes cannot be combined.');
  const value = flag => args[args.indexOf(flag) + 1];
  const get = flag => args.includes(flag) ? value(flag) : undefined;
  if (!args.includes('--apply')) {
    const inventory = get('--inventory') ? JSON.parse(fs.readFileSync(get('--inventory'), 'utf8')) : { source: 'proposal-only', target: null, schema: schemaDigest(), locales, records: [], technologies: [] };
    const plan = buildPlan(inventory);
    console.log(JSON.stringify(plan, null, 2));
    if (get('--out')) save(get('--out'), plan);
    return;
  }
  const plan = JSON.parse(fs.readFileSync(get('--plan'), 'utf8'));
  validatePlan(plan, get('--confirm-plan'));
  if (!args.includes('--publish') || !args.includes('--confirm-production') || !args.includes('--confirm-backup-verified') || process.env.NODE_ENV !== 'production') throw new SeedError('Explicit production, publication and verified-backup confirmations are required.');
  const authorization = await verifyBackup(plan, get('--backup'), get('--backup-evidence'));
  if (!get('--api-url')) throw new SeedError('API verification URL is required.');
  await ensureApiReadable(get('--api-url'), process.env.STRAPI_READ_TOKEN);
  const { createStrapi, compileStrapi } = require('@strapi/strapi');
  const app = createStrapi(await compileStrapi());
  try { await app.load(); await seed(app, plan, { confirmPlan: plan.digest, publish: true, confirmProduction: true, authorization, apiUrl: get('--api-url'), apiToken: process.env.STRAPI_READ_TOKEN }); }
  finally { await app.destroy(); }
}
if (require.main === module) main(process.argv.slice(2)).catch(error => { console.error(JSON.stringify({ status: 'failed', message: error instanceof SeedError ? error.message : 'Import refused or failed. Review backup evidence and record-level failures. No automatic retry is performed.' })); process.exitCode = 1; });
module.exports = { candidates, technologies, localizedData, buildPlan, readInventory, captureInventory, validatePlan, verifyBackup, verifyApi, seed, digest, schemaDigest, main };
