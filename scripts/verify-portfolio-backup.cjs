'use strict';
// Explicit operator command, never run by application bootstrap or CI.
// Production is read only. All restores/mutation tests use a private cluster.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process'), crypto = require('node:crypto');
const { Client } = require('pg');
const legacy = require('./seed-projects.cjs'), migration = require('./seed-portfolio.cjs');
async function main(seedTest) {
  require('dotenv').config({ quiet: true });
  const config = require('../dist/config/database.js').default({ env: require('@strapi/utils').env }).connection;
  if (config.client !== 'postgres') throw Error('PostgreSQL required');
  const c = config.connection, parsed = c.connectionString ? new URL(c.connectionString) : null;
  const env = { ...process.env, PGHOST: parsed?.hostname || c.host, PGPORT: String(parsed?.port || c.port || 5432), PGDATABASE: parsed?.pathname.slice(1) || c.database, PGUSER: parsed?.username ? decodeURIComponent(parsed.username) : c.user, PGPASSWORD: parsed?.password ? decodeURIComponent(parsed.password) : c.password };
  if (env.PGDATABASE !== 'omerali_strapi') throw Error('Unexpected production target');
  const run = (command, args, overrides = {}) => { const result = cp.spawnSync(command, args, { env, encoding: 'utf8', ...overrides }); if (result.status !== 0 || result.error) throw Error(`Operator tool failed: ${path.basename(command)}`); return result.stdout; };
  const bin = run('pg_config', ['--bindir']).trim();
  const archive = path.resolve(`seed-review/phase5-${new Date().toISOString().replace(/[:.]/g, '-')}.dump`);
  fs.mkdirSync('seed-review', { recursive: true });
  run('pg_dump', ['--format=custom', '--no-owner', '--no-acl', '--file', archive]); fs.chmodSync(archive, 0o600);
  if (!run('pg_restore', ['--list', archive]).includes('dbname: omerali_strapi')) throw Error('Archive target mismatch');
  const temp = fs.mkdtempSync('/tmp/omerali-phase5-restore-'); fs.chmodSync(temp, 0o700);
  const data = path.join(temp, 'data'), socket = path.join(temp, 'socket'); fs.mkdirSync(socket, { mode: 0o700 }); let running = false, app;
  try {
    run(path.join(bin, 'initdb'), ['-D', data, '--auth-local=trust', '--auth-host=reject', '--no-locale']);
    run(path.join(bin, 'pg_ctl'), ['-D', data, '-l', path.join(temp, 'postgres.log'), '-o', `-c listen_addresses='' -k ${socket} -p 55435`, '-w', 'start']); running = true;
    const privateEnv = { ...env, PGHOST: socket, PGPORT: '55435', PGUSER: process.env.USER || 'deploy', PGPASSWORD: '', PGDATABASE: 'phase5_restore' };
    run('createdb', ['phase5_restore'], { env: { ...privateEnv, PGDATABASE: 'postgres' } });
    run('pg_restore', ['--exit-on-error', '--no-owner', '--no-acl', '--dbname', 'phase5_restore', archive], { env: privateEnv });
    const source = new Client(c), restored = new Client({ host: socket, port: 55435, user: privateEnv.PGUSER, database: 'phase5_restore' });
    await source.connect(); await restored.connect(); const counts = {};
    try {
      for (const table of ['projects', 'technologies', 'projects_technologies_lnk', 'i18n_locale', 'abouts', 'globals']) { const sql = `select count(*)::int as count from "${table}"`; const a = (await source.query(sql)).rows[0].count, b = (await restored.query(sql)).rows[0].count; if (a !== b) throw Error('Restore record mismatch'); counts[table] = b; }
      const count = (await restored.query("select count(*)::int as n from information_schema.tables where table_schema='public'")).rows[0].n; if (count < 20) throw Error('Incomplete restore structure');
      const evidence = { sha256: crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex'), target: legacy.targetFingerprintDatabase(config), verifiedAt: new Date().toISOString(), restoreTested: true, archive, restoredTables: count, restoredCounts: counts, isolatedSocketOnly: true };
      migration.save('seed-review/phase5-backup-evidence.json', evidence); console.log(JSON.stringify({ status: 'backup-verified', ...evidence }));
    } finally { await source.end(); await restored.end(); }
    if (seedTest) {
      Object.assign(process.env, { NODE_ENV: 'production', DATABASE_CLIENT: 'postgres', DATABASE_URL: '', DATABASE_HOST: socket, DATABASE_PORT: '55435', DATABASE_NAME: 'phase5_restore', DATABASE_USERNAME: privateEnv.PGUSER, DATABASE_PASSWORD: '', DATABASE_SSL: 'false', STRAPI_TELEMETRY_DISABLED: 'true' });
      const { createStrapi, compileStrapi } = require('@strapi/strapi'); app = createStrapi(await compileStrapi());
      // Prove configuration is isolated before ANY framework startup or schema sync.
      if (app.config.get('database.connection.connection.host') !== socket || app.config.get('database.connection.connection.database') !== 'phase5_restore') throw Error('Isolated runtime target mismatch');
      await app.load(); const isolated = app.config.get('database.connection');
      const client = new Client(isolated.connection); await client.connect();
      try {
        const capture = () => migration.inventory((sql, params) => client.query(sql, params), isolated);
        const plan = migration.buildPlan(await capture()); migration.validatePlan(plan, plan.digest);
        // Genuinely back up the isolated runtime and restore that archive too;
        // never relabel production-target evidence as isolated authorization.
        const isolatedArchive = path.join(temp, 'isolated.dump'); run('pg_dump', ['--format=custom', '--no-owner', '--no-acl', '--file', isolatedArchive], { env: privateEnv });
        run('createdb', ['phase5_recovery'], { env: { ...privateEnv, PGDATABASE: 'postgres' } });
        run('pg_restore', ['--exit-on-error', '--no-owner', '--no-acl', '--dbname', 'phase5_recovery', isolatedArchive], { env: privateEnv });
        const evidence = path.join(temp, 'evidence.json'); migration.save(evidence, { sha256: crypto.createHash('sha256').update(fs.readFileSync(isolatedArchive)).digest('hex'), target: plan.inventory.target, verifiedAt: new Date().toISOString(), restoreTested: true });
        let rejectPublish = true; app.documents.use(async (context, next) => { if (rejectPublish && context.action === 'publish') throw Error('Isolated rollback regression'); return next(); });
        const options = { confirmPlan: plan.digest, authorization: await migration.authorize(plan, isolatedArchive, evidence), confirmProduction: true, publish: true };
        let rejected = false; try { await migration.seed(app, plan, options); } catch { rejected = true; }
        if (!rejected || legacy.digest(await capture()) !== legacy.digest(plan.inventory)) throw Error('Real PostgreSQL rollback regression failed');
        rejectPublish = false; const result = await migration.seed(app, plan, options);
        const next = migration.buildPlan(await capture()); if (next.conflicts.length || next.records.some(r => r.action !== 'skip-existing' || r.publication !== 'skip-published') || next.technologies.some(t => t.action !== 'skip-existing')) throw Error('Real PostgreSQL idempotence regression failed');
        console.log(JSON.stringify({ status: 'isolated-seed-verified', rollback: true, idempotent: true, published: result.events.filter(e => e.status === 'published').length, protectedProjects: true }));
      } finally { await client.end(); }
    }
  } finally {
    if (app) await app.destroy();
    if (running) run(path.join(bin, 'pg_ctl'), ['-D', data, '-w', 'stop', '-m', 'fast']);
    if (!temp.startsWith('/tmp/omerali-phase5-restore-')) throw Error('Unexpected cleanup path');
    fs.rmSync(temp, { recursive: true, force: true });
  }
}
if (require.main === module) main(process.argv.includes('--isolated-seed-test')).catch(error => { console.error(JSON.stringify({ status: 'operator-failed', diagnostic: legacy.errorDiagnostic(error), message: /^Operator tool failed:/.test(error.message) ? error.message : 'Backup/isolated verification failed; production content was not changed.' })); process.exitCode = 1; });
