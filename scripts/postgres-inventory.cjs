'use strict';
// Inventory only. Content mutations remain exclusively in Strapi Document Service.
const SOURCE = 'postgres-read-only';
const MODE = 'empty-portfolio-v1';
const tables = ['projects', 'technologies', 'i18n_locale', 'projects_technologies_lnk', 'projects_cmps'];
const quote = name => '"' + String(name).replaceAll('"', '""') + '"';
const fail = message => { throw new Error(`PostgreSQL inventory refused: ${message}`); };

async function readPostgresInventory(query, database, helpers) {
  const { digest, schemaDigest, targetFingerprintDatabase } = helpers;
  if (database.client !== 'postgres') fail('PostgreSQL configuration required.');
  const connection = database.connection;
  const schema = connection.schema || 'public';
  const table = name => `${quote(schema)}.${quote(name)}`;
  const rows = async (sql, parameters = []) => (await query(sql, parameters)).rows;
  const [identity] = await rows("SELECT current_database() AS database, current_setting('transaction_read_only') AS read_only, current_setting('transaction_isolation') AS isolation");
  const url = connection.connectionString ? new URL(connection.connectionString) : null;
  if (identity.database !== (url?.pathname.slice(1) || connection.database)) fail('connected database does not match configuration.');
  // SERIALIZABLE is used only during the subsequent approved content transaction.
  if (!['repeatable read', 'serializable'].includes(identity.isolation)) fail('consistent transaction required.');
  const columns = await rows('SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema=$1 AND table_name=ANY($2::text[]) ORDER BY table_name,column_name', [schema, tables]);
  const required = {
    projects: { id: 'integer', document_id: 'character varying', slug: 'character varying', locale: 'character varying', published_at: 'timestamp without time zone', featured: 'boolean', display_order: 'integer' },
    technologies: { id: 'integer', document_id: 'character varying', slug: 'character varying', name: 'character varying' },
    i18n_locale: { code: 'character varying' },
    projects_technologies_lnk: { project_id: 'integer', technology_id: 'integer' },
    projects_cmps: { entity_id: 'integer', cmp_id: 'integer', component_type: 'character varying', field: 'character varying' },
  };
  for (const [name, fields] of Object.entries(required)) for (const [column, type] of Object.entries(fields)) {
    if (!columns.some(c => c.table_name === name && c.column_name === column && c.data_type === type)) fail(`unrecognized deployed mapping: ${name}.${column}.`);
  }
  const foreignKeys = await rows(`SELECT t.relname AS table_name, r.relname AS referenced_table,
    ARRAY(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY k(num,ord) JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.num ORDER BY k.ord) AS columns,
    ARRAY(SELECT a.attname::text FROM unnest(c.confkey) WITH ORDINALITY k(num,ord) JOIN pg_attribute a ON a.attrelid=c.confrelid AND a.attnum=k.num ORDER BY k.ord) AS referenced_columns
    FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
    JOIN pg_class r ON r.oid=c.confrelid JOIN pg_namespace rn ON rn.oid=r.relnamespace
    WHERE c.contype='f' AND n.nspname=$1 AND rn.nspname=$1 AND t.relname=ANY($2::text[])
    ORDER BY t.relname,r.relname,c.conname`, [schema, tables]);
  for (const [link, column, target] of [['projects_technologies_lnk','project_id','projects'], ['projects_technologies_lnk','technology_id','technologies'], ['projects_cmps','entity_id','projects']]) {
    if (!foreignKeys.some(f => f.table_name === link && f.referenced_table === target && f.columns.join(',') === column && f.referenced_columns.join(',') === 'id')) fail(`unverified relationship: ${link}.${column}.`);
  }
  const configured = (await rows(`SELECT code FROM ${table('i18n_locale')} ORDER BY code`)).map(r => r.code);
  if (!['en','ar'].every(locale => configured.includes(locale)) || new Set(configured).size !== configured.length) fail('unique en and ar locales required.');
  const projects = await rows(`SELECT * FROM ${table('projects')} ORDER BY id`);
  const technologies = await rows(`SELECT * FROM ${table('technologies')} ORDER BY id`);
  const links = await rows(`SELECT * FROM ${table('projects_technologies_lnk')} ORDER BY id`);
  const components = await rows(`SELECT * FROM ${table('projects_cmps')} ORDER BY id`);
  // These summaries deliberately do not claim full Document Service hydration.
  // Any nonempty table blocks application: components, media, implicit localization
  // and custom middleware cannot safely be reproduced with a generic SQL mapper.
  const summary = row => ({ id: row.id, documentId: row.document_id, slug: row.slug, locale: row.locale, publishedAt: row.published_at, featured: row.featured, displayOrder: row.display_order, projectType: row.project_type,
    technologies: links.filter(l => l.project_id === row.id).map(l => { const t = technologies.find(t => t.id === l.technology_id); return t ? { documentId: t.document_id, name: t.name, slug: t.slug } : { missingRelatedId: l.technology_id }; }) });
  return {
    source: SOURCE, target: targetFingerprintDatabase(database), schema: schemaDigest(), locales: configured,
    records: projects.map(row => ({ status: row.published_at ? 'published' : 'draft', record: summary(row) })),
    technologies: technologies.map(row => ({ id: row.id, documentId: row.document_id, name: row.name, slug: row.slug })),
    sql: { mode: MODE, structure: digest({ columns, foreignKeys }), counts: { projects: projects.length, technologies: technologies.length, technologyLinks: links.length, componentLinks: components.length },
      snapshot: digest({ projects, technologies, links, components }),
      limitations: projects.length || technologies.length || links.length || components.length ? ['Existing content requires complete Document Service inventory; SQL summaries cannot authorize mutations.'] : [] },
  };
}

function sqlInventoryConflicts(inventory) {
  if (inventory.source !== SOURCE) return [];
  const sql = inventory.sql;
  if (sql?.mode !== MODE || !/^[a-f0-9]{64}$/.test(sql?.structure || '') || !/^[a-f0-9]{64}$/.test(sql?.snapshot || '') || !sql.counts || !Array.isArray(sql.limitations)) return ['Invalid PostgreSQL inventory verification.'];
  if (Object.keys(sql.counts).sort().join(',') !== 'componentLinks,projects,technologies,technologyLinks' || Object.values(sql.counts).some(count => count !== 0) || inventory.records.length || inventory.technologies.length || sql.limitations.length) return ['Existing content or relationships require complete Document Service inventory. SQL inventory cannot authorize this import.'];
  return [];
}

async function capturePostgresInventory(database, file, helpers, Client = require('pg').Client) {
  const c = database.connection;
  const client = new Client({ ...c, connectionString: c.connectionString, application_name: 'portfolio-readonly-inventory', connectionTimeoutMillis: 10000 });
  try {
    await client.connect();
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await client.query("SET LOCAL statement_timeout = '30s'");
    const inventory = await readPostgresInventory(client.query.bind(client), database, helpers);
    // Do not accept a connection that was not actually protected by READ ONLY.
    const { rows } = await client.query("SELECT current_setting('transaction_read_only') AS read_only");
    if (rows[0]?.read_only !== 'on') fail('read-only transaction not enforced.');
    await client.query('ROLLBACK');
    helpers.save(file, inventory);
    return inventory;
  } finally {
    // End rolls back on failures; no reconnect/retry or database mutation occurs.
    await client.end();
  }
}
module.exports = { SOURCE, MODE, readPostgresInventory, capturePostgresInventory, sqlInventoryConflicts };
