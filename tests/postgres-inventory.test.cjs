const test=require('node:test');
const assert=require('node:assert/strict');
const importer=require('../scripts/seed-projects.cjs');
const {readPostgresInventory}=require('../scripts/postgres-inventory.cjs');
const {database,fixture}=require('./postgres-fixture.cjs');
const helpers={digest:importer.digest,schemaDigest:importer.schemaDigest,targetFingerprintDatabase:importer.targetFingerprintDatabase};
const read=f=>readPostgresInventory(f.query,database,helpers);
test('SQL capture uses a separate connection, consistent read-only transaction and rolls back before saving',async()=>{
 const f=fixture();let connected=false,ended=false,saved=false;
 class Client{async connect(){connected=true;}async query(sql,values){return f.query(sql,values);}async end(){ended=true;}}
 const inventory=await require('../scripts/postgres-inventory.cjs').capturePostgresInventory(database,'unused',{...helpers,save:()=>{assert.equal(f.state.statements.at(-1).sql,'ROLLBACK');saved=true;}},Client);
 assert.ok(connected&&ended&&saved);assert.equal(inventory.source,'postgres-read-only');assert.equal(f.state.statements[0].sql,'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');assert.ok(f.state.statements.every(({sql})=>!/^\s*(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP)\b/i.test(sql)));assert.deepEqual(inventory.sql.counts,{projects:0,technologies:0,technologyLinks:0,componentLinks:0});importer.validatePlan(importer.buildPlan(inventory),importer.buildPlan(inventory).digest);
});
test('actual database identity, schema mapping, relation mapping and both locales must be verified',async()=>{
 for(const change of [f=>f.state.database='other',f=>f.state.isolation='read committed',f=>f.state.columns.pop(),f=>f.state.foreignKeys.pop(),f=>f.state.locales=['en']]){const f=fixture();change(f);await assert.rejects(read(f));}
 const f=fixture();f.state.readOnly='off';let saved=false,ended=false;class Client{async connect(){}async query(sql,v){return f.query(sql,v);}async end(){ended=true;}}
 await assert.rejects(require('../scripts/postgres-inventory.cjs').capturePostgresInventory(database,'unused',{...helpers,save:()=>saved=true},Client));assert.equal(saved,false);assert.equal(ended,true);
});
test('draft and published localizations and technologies are summarized honestly and block unsupported hydration',async()=>{
 const f=fixture();f.state.projects=[{id:1,slug:'grc-platform',document_id:'same',locale:'en',published_at:null,featured:true,display_order:1,project_type:'Enterprise'},{id:2,slug:'grc-platform',document_id:'same',locale:'ar',published_at:'2026-01-01',featured:true,display_order:1,project_type:'Enterprise'}];f.state.technologies=[{id:3,document_id:'angular-document',name:'Angular',slug:'angular'}];f.state.links=[{id:1,project_id:1,technology_id:3}];const inventory=await read(f);assert.equal(inventory.records[0].status,'draft');assert.equal(inventory.records[1].status,'published');assert.equal(inventory.records[0].record.technologies[0].documentId,'angular-document');assert.equal(inventory.sql.counts.technologyLinks,1);const plan=importer.buildPlan(inventory);assert.ok(plan.conflicts.some(c=>c.includes('complete Document Service')));assert.throws(()=>importer.validatePlan(plan,plan.digest));
});
test('duplicate document identifiers and technology conflicts are not hidden by SQL summaries',async()=>{
 const f=fixture();f.state.projects=[{id:1,slug:'grc-platform',document_id:'one',locale:'en'},{id:2,slug:'grc-platform',document_id:'two',locale:'ar'}];f.state.technologies=[{id:1,document_id:'tech1',name:'Angular',slug:'angular'},{id:2,document_id:'tech2',name:'Different',slug:'angular'}];const plan=importer.buildPlan(await read(f));assert.ok(plan.conflicts.some(c=>c.includes('Multiple documents')));assert.ok(plan.conflicts.some(c=>c.includes('Ambiguous technology')));
});
test('snapshot and plan digests include relationships and structure; changing content invalidates approval',async()=>{
 const f=fixture();const first=await read(f);assert.deepEqual(await read(f),first);const plan=importer.buildPlan(first);const changed=structuredClone(plan);changed.inventory.sql.structure='0'.repeat(64);assert.throws(()=>importer.validatePlan(changed,plan.digest));f.state.components.push({id:1,entity_id:999,cmp_id:1,component_type:'project.feature',field:'features'});const next=await read(f);assert.notEqual(next.sql.snapshot,first.sql.snapshot);assert.ok(importer.buildPlan(next).conflicts.length);
});
test('database fingerprint matches existing URL and schema semantics without including credentials',()=>{
 const a=importer.targetFingerprintDatabase(database);assert.equal(a,importer.targetFingerprintDatabase({...database,connection:{...database.connection,user:'secret-user',password:'secret'}}));assert.notEqual(a,importer.targetFingerprintDatabase({...database,connection:{...database.connection,database:'other'}}));assert.notEqual(a,importer.targetFingerprintDatabase({...database,connection:{...database.connection,schema:'other'}}));const url={client:'postgres',connection:{connectionString:'postgres://u:p@test-only:5432/fixture',schema:'public'}};assert.equal(importer.targetFingerprintDatabase(url),importer.targetFingerprintDatabase({client:'postgres',connection:{host:'test-only',port:'5432',database:'fixture',schema:'public'}}));
});
