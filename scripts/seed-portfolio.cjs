'use strict';
const fs = require('node:fs');
const path = require('node:path');
const legacy = require('./seed-projects.cjs');
const { candidates, catalog } = require('./portfolio-content.cjs');
const { digest, targetFingerprintDatabase, errorDiagnostic } = legacy;
const uid = type => `api::${type}.${type}`;
const tables = { global: 'globals', about: 'abouts', service: 'services', experience: 'experiences' };
const allowed = new WeakSet();
const save = (file, value) => { fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 }); };
function schemaDigest() {
  const files = ['global', 'about', 'service', 'experience', 'project', 'technology'].map(n => `src/api/${n}/content-types/${n}/schema.json`);
  files.push(...fs.readdirSync(path.join(__dirname, '../src/components/portfolio')).sort().map(n => `src/components/portfolio/${n}`));
  return digest(files.map(f => JSON.parse(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'))));
}
function identifier(value) { if (!/^[a-z][a-z0-9_]*$/.test(value)) throw Error('Unsupported database identifier'); return `"${value}"`; }
async function inventory(query, config) {
  const schema = config.connection.schema || 'public';
  const target = targetFingerprintDatabase(config);
  const actual = (await query('select current_database() as database')).rows[0].database;
  const expected = config.connection.connectionString ? new URL(config.connection.connectionString).pathname.slice(1) : config.connection.database;
  if (actual !== expected) throw Error('Connected database target mismatch');
  const found = await query("select table_name from information_schema.tables where table_schema=$1 and table_type='BASE TABLE' order by table_name", [schema]);
  const relevant = found.rows.map(r => r.table_name).filter(n => /^(globals|abouts|services|experiences|projects|technologies)(_|$)|^components_(portfolio|project)_/.test(n));
  const snapshots = {};
  for (const name of relevant) snapshots[name] = (await query(`select * from ${identifier(schema)}.${identifier(name)} order by id`)).rows;
  const columns = (await query('select table_name,column_name,data_type,is_nullable from information_schema.columns where table_schema=$1 order by table_name,ordinal_position', [schema])).rows.filter(c => relevant.includes(c.table_name));
  const constraints = (await query('select t.relname as table_name,c.conname,pg_get_constraintdef(c.oid) as definition from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace where n.nspname=$1 order by t.relname,c.conname', [schema])).rows.filter(c => relevant.includes(c.table_name));
  const locales = (await query(`select code from ${identifier(schema)}.i18n_locale order by code`)).rows.map(r => r.code);
  return { source: 'phase5-postgres-read-only', target, schema: schemaDigest(), columns, constraints, locales, snapshots };
}
async function capture(file) {
  require('dotenv').config({ quiet: true });
  const config = require('../dist/config/database.js').default({ env: require('@strapi/utils').env }).connection;
  const client = new (require('pg').Client)(config.connection);
  try { await client.connect(); await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY'); const result = await inventory((sql, params) => client.query(sql, params), config); await client.query('ROLLBACK'); save(file, result); return result; }
  finally { await client.end(); }
}
function buildPlan(current) {
  const conflicts = [];
  if (current.source !== 'phase5-postgres-read-only' || !/^[a-f0-9]{64}$/.test(current.target || '')) conflicts.push('Genuine production inventory required');
  if (current.schema !== schemaDigest() || !['en', 'ar'].every(l => current.locales.includes(l))) conflicts.push('Schema/locale mismatch');
  for (const table of Object.values(tables)) if (!current.snapshots[table]) conflicts.push(`Missing deployed table: ${table}`);
  for (const [type, table] of Object.entries(tables)) {
    const keys = new Set(candidates.filter(c => c.type === type).map(c => c.key));
    if ((current.snapshots[table] || []).some(r => !keys.has(r.seed_key || r.slug))) conflicts.push(`Unreviewed content exists in ${type}`);
  }
  const technologies = catalog.map(t => {
    const matches = (current.snapshots.technologies || []).filter(r => r.slug === t.slug || r.name.toLowerCase() === t.name.toLowerCase());
    if (matches.length > 1 || matches.some(r => r.name !== t.name || r.slug !== t.slug)) conflicts.push(`Ambiguous technology: ${t.slug}`);
    return { ...t, documentId: matches[0]?.document_id, action: matches.length ? 'skip-existing' : 'create' };
  });
  const records = candidates.map(c => {
    const rows = (current.snapshots[tables[c.type]] || []).filter(r => (r.seed_key || r.slug) === c.key);
    const ids = [...new Set(rows.map(r => r.document_id))];
    if (ids.length > 1) conflicts.push(`Duplicate document: ${c.type}/${c.key}`);
    const versions = rows.filter(r => r.locale === c.locale);
    if (versions.filter(r => r.published_at).length > 1 || versions.filter(r => !r.published_at).length > 1) conflicts.push(`Duplicate locale: ${c.type}/${c.key}/${c.locale}`);
    if (['global', 'about'].includes(c.type) && (current.snapshots[tables[c.type]] || []).some(r => r.seed_key !== c.key)) conflicts.push(`Existing single type outside approved scope: ${c.type}`);
    return { ...c, documentId: ids[0], action: versions.length ? 'skip-existing' : 'create', publication: versions.some(r => r.published_at) ? 'skip-published' : versions.length ? 'skip-unapproved-existing-draft' : 'publish-new' };
  });
  const body = { format: 1, inventory: current, technologies, records, conflicts: [...new Set(conflicts)], scope: 'Confirmed Phase 5 content only; no overwrites or deletes; preserve projects and existing technology rows.' };
  return { ...body, digest: digest(body) };
}
function validatePlan(plan, confirmation) {
  const { digest: hash, ...body } = plan;
  if (hash !== confirmation || hash !== digest(body) || digest(buildPlan(plan.inventory)) !== digest(plan)) throw Error('Plan digest/candidates do not match review');
  if (plan.conflicts.length) throw Error('Plan conflicts prevent application');
}
async function authorize(plan, file, evidence) { const result = await legacy.verifyBackup(plan, file, evidence); allowed.add(result); return result; }
async function verifyApi(base, fetcher = fetch) {
  const origin = new URL(base);
  if (origin.protocol !== 'https:' || origin.username || origin.password) throw Error('Secure public API origin required');
  const verified = [];
  for (const locale of ['en', 'ar']) for (const [model, count] of [['global', 1], ['about', 1], ['services', 6], ['experiences', 7]]) {
    const url = new URL(`/api/${model}`, origin); url.searchParams.set('locale', locale); url.searchParams.set('status', 'published');
    if (count > 1) url.searchParams.set('pagination[pageSize]', '100');
    const response = await fetcher(url, { redirect: 'error', signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw Error('Public API verification unavailable');
    const body = await response.json(), rows = Array.isArray(body.data) ? body.data : body.data ? [body.data] : [];
    if (rows.length !== count || rows.some(r => !r.publishedAt || r.locale !== locale || !r.documentId || r.enabled !== true)) throw Error('Public API publication mismatch');
    verified.push({ model, locale, published: rows.length });
  }
  return verified;
}
async function seed(strapi, plan, options) {
  validatePlan(plan, options.confirmPlan);
  if (!options.confirmProduction || !options.publish || !allowed.has(options.authorization) || options.authorization.target !== plan.inventory.target) throw Error('Reviewed plan and verified backup authorization required');
  let stage = 'transaction-begin', record, committed = false;
  const events = [];
  try {
    await strapi.db.transaction(async ({ trx }) => {
      await trx.raw('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
      await trx.raw("SET LOCAL lock_timeout = '15s'");
      const schema = strapi.config.get('database.connection.connection.schema') || 'public';
      const names = Object.keys(plan.inventory.snapshots).sort();
      stage = 'locking-and-inventory';
      await trx.raw(`LOCK TABLE ${names.map(n => `${identifier(schema)}.${identifier(n)}`).join(',')} IN SHARE ROW EXCLUSIVE MODE`);
      const query = (sql, values = []) => { const bindings = []; return trx.raw(sql.replace(/\$(\d+)/g, (_, n) => { bindings.push(values[Number(n) - 1]); return '?'; }), bindings); };
      const current = await inventory(query, strapi.config.get('database.connection'));
      if (digest(current) !== digest(plan.inventory)) throw Error('Production inventory drift; no writes permitted');
      const techIds = {};
      for (const t of plan.technologies) {
        stage = 'technology'; record = t.slug;
        if (t.documentId) techIds[t.slug] = t.documentId;
        else { const { action, documentId, ...data } = t; techIds[t.slug] = (await strapi.documents(uid('technology')).create({ data })).documentId; }
        events.push({ status: t.documentId ? 'skipped' : 'created', type: 'technology', key: t.slug, documentId: techIds[t.slug] });
      }
      const ids = {};
      for (const item of plan.records) {
        record = `${item.type}/${item.key}/${item.locale}`; stage = 'document-preflight';
        const existing = await strapi.documents(uid(item.type)).findMany({ locale: item.locale, status: 'draft', filters: { [['global', 'about'].includes(item.type) ? 'seedKey' : 'slug']: item.key }, limit: 100 });
        if (existing.length > 1 || (item.action === 'create' && existing.length)) throw Error('Document Service conflict');
        const identity = `${item.type}/${item.key}`;
        let documentId = ids[identity] || item.documentId;
        if (item.action === 'skip-existing') { ids[identity] = documentId; events.push({ status: 'skipped', record, documentId }); continue; }
        const data = structuredClone(item.data);
        if (item.type === 'about') for (const group of data.stack) for (const skill of group.items) { skill.technology = techIds[skill.technology]; if (!skill.technology) throw Error('Missing skill technology'); }
        stage = 'localized-creation';
        const created = documentId ? await strapi.documents(uid(item.type)).update({ documentId, locale: item.locale, status: 'draft', data }) : await strapi.documents(uid(item.type)).create({ locale: item.locale, status: 'draft', data });
        if (documentId && documentId !== created.documentId) throw Error('Localization document identifier mismatch');
        documentId = created.documentId; ids[identity] = documentId;
        events.push({ status: 'created', record, documentId });
      }
      for (const item of plan.records) if (item.publication === 'publish-new') {
        stage = 'publication'; record = `${item.type}/${item.key}/${item.locale}`;
        const documentId = ids[`${item.type}/${item.key}`];
        await strapi.documents(uid(item.type)).publish({ documentId, locale: item.locale });
        const result = await strapi.documents(uid(item.type)).findOne({ documentId, locale: item.locale, status: 'published' });
        if (!result?.publishedAt || result.locale !== item.locale || result.documentId !== documentId || result.enabled !== true) throw Error('Publication verification failed');
        events.push({ status: 'published', record, documentId });
      }
      stage = 'protected-content-verification';
      const after = await inventory(query, strapi.config.get('database.connection'));
      for (const table of names.filter(n => /^projects(_|$)|^components_project_/.test(n))) if (digest(after.snapshots[table]) !== digest(current.snapshots[table])) throw Error('Protected project state changed');
      for (const t of current.snapshots.technologies) if (digest(after.snapshots.technologies.find(r => r.id === t.id)) !== digest(t)) throw Error('Existing technology changed');
      stage = 'transaction-commit';
    });
    committed = true; events.forEach(e => console.log(JSON.stringify(e)));
    return { committed, events };
  } catch (error) { console.error(JSON.stringify({ status: 'failed', committed, stage, record, diagnostic: errorDiagnostic(error), recovery: stage === 'transaction-commit' ? 'Outcome uncertain; inspect before any retry.' : 'Do not retry writes automatically; capture and review inventory.' })); throw error; }
}
async function main(args) {
  const get = flag => args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined;
  if (args.includes('--capture')) { if (args.includes('--apply') || !get('--out')) throw Error('Capture requires output and cannot apply'); const inv = await capture(get('--out')); console.log(JSON.stringify({ target: inv.target, locales: inv.locales, counts: Object.fromEntries(Object.entries(inv.snapshots).map(([k,v]) => [k,v.length])) })); return; }
  if (!args.includes('--apply')) { if (!get('--inventory') || !get('--out')) throw Error('Dry-run requires inventory/output'); const plan = buildPlan(JSON.parse(fs.readFileSync(get('--inventory')))); save(get('--out'), plan); console.log(JSON.stringify({ digest: plan.digest, conflicts: plan.conflicts, records: plan.records.map(({type,key,locale,action,publication}) => ({type,key,locale,action,publication})), technologies: plan.technologies.map(({slug,action})=>({slug,action})) })); return; }
  const plan = JSON.parse(fs.readFileSync(get('--plan'))); validatePlan(plan, get('--confirm-plan'));
  if (args.includes('--dry-run') || !args.includes('--publish') || !args.includes('--confirm-production') || !args.includes('--confirm-backup-verified') || process.env.NODE_ENV !== 'production') throw Error('Explicit production/publication/backup gates required');
  const authorization = await authorize(plan, get('--backup'), get('--backup-evidence'));
  if (!get('--api-url')) throw Error('Public API verification URL required');
  const {createStrapi,compileStrapi}=require('@strapi/strapi'); const app=createStrapi(await compileStrapi());
  let committed = false;
  try { await app.load(); await seed(app,plan,{confirmPlan:plan.digest,authorization,confirmProduction:true,publish:true}); committed = true; console.log(JSON.stringify({status:'verified',committed,records:await verifyApi(get('--api-url'))})); }
  catch(error) { if(committed) console.error(JSON.stringify({status:'api-verification-failed',committed:true,recovery:'Inspect published state; never retry writes automatically.'})); throw error; }
  finally { await app.destroy(); }
}
if (require.main === module) main(process.argv.slice(2)).catch(e=>{console.error(JSON.stringify({status:'failed',diagnostic:errorDiagnostic(e),message:'Phase 5 refused or failed; inspect gates and sanitized stage. No automatic write retries.'}));process.exitCode=1;});
module.exports={inventory,capture,buildPlan,validatePlan,authorize,seed,verifyApi,schemaDigest,save};
