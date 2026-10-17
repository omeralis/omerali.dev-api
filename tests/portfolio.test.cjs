const test = require('node:test');
const assert = require('node:assert/strict');
const seeder = require('../scripts/seed-portfolio.cjs');
const legacy = require('../scripts/seed-projects.cjs');
const { candidates, catalog } = require('../scripts/portfolio-content.cjs');
const config = { client:'postgres', connection:{host:'fixture',database:'fixture',schema:'public'} };
function fixture() {
  let state = { globals:[],abouts:[],services:[],experiences:[],projects:[{id:1,document_id:'preserved-project'}],technologies:[{id:1,document_id:'angular-id',name:'Angular',slug:'angular',category:'Frontend',display_order:1}] };
  let sequence = 10, failPublish = false;
  const table = type => ({global:'globals',about:'abouts',service:'services',experience:'experiences',technology:'technologies'})[type];
  const query = async (sql, parameters) => {
    if (sql.startsWith('select current_database')) return {rows:[{database:'fixture'}]};
    if (sql.includes('information_schema.tables')) return {rows:Object.keys(state).sort().map(table_name=>({table_name}))};
    if (sql.includes('information_schema.columns') || sql.includes('pg_constraint')) return {rows:[]};
    if (sql.includes('i18n_locale')) return {rows:[{code:'ar'},{code:'en'}]};
    if (sql.startsWith('select row_to_json')) return {rows:structuredClone(state[sql.match(/\."([^"]+)"/)[1]]).map(row=>({row}))};
    if (/^SET|^LOCK/.test(sql)) return {};
    throw Error('Unexpected SQL');
  };
  const strapi = {config:{get:key=>key.endsWith('schema')?'public':config},db:{transaction:async fn=>{const before=structuredClone(state);try{return await fn({trx:{raw:query}});}catch(e){state=before;throw e;}}},documents:uid=>{
    const type=uid.split('::')[1].split('.')[0], name=table(type);
    return {
      findMany:async ({locale,filters,status})=>state[name].filter(r=>r.locale===locale&&!r.published_at&&(!filters.slug||r.slug===filters.slug)&&(!filters.seedKey||r.seed_key===filters.seedKey)).map(r=>({...r,documentId:r.document_id})),
      create:async ({locale,data})=>{const documentId=`doc-${++sequence}`;state[name].push({id:sequence,document_id:documentId,locale,...data,seed_key:data.seedKey});return {documentId};},
      update:async ({documentId,locale,data})=>{state[name].push({id:++sequence,document_id:documentId,locale,...data,seed_key:data.seedKey});return {documentId};},
      publish:async ({documentId,locale})=>{if(failPublish)throw Error('Fixture publication failure');const r=state[name].find(r=>r.document_id===documentId&&r.locale===locale);state[name].push({...r,id:++sequence,published_at:'2026-01-01'});},
      findOne:async ({documentId,locale})=>{const r=state[name].find(r=>r.document_id===documentId&&r.locale===locale&&r.published_at);return r?{...r,documentId:r.document_id,publishedAt:r.published_at}:null;},
    };
  }};
  return {query,strapi,state:()=>state,fail:()=>failPublish=true,inventory:()=>seeder.inventory(query,config)};
}
async function authorized(plan) { const original = legacy.verifyBackup; try {legacy.verifyBackup=async()=>({target:plan.inventory.target});return await seeder.authorize(plan,'fixture','fixture');}finally{legacy.verifyBackup=original;} }
test('confirmed migration has exactly fifteen bilingual documents and no invented optional facts',()=>{
  assert.equal(candidates.length,30);assert.equal(catalog.length,14);
  for(const locale of ['en','ar']){assert.equal(candidates.filter(c=>c.locale===locale&&c.type==='service').length,6);assert.equal(candidates.filter(c=>c.locale===locale&&c.type==='experience').length,7);const g=candidates.find(c=>c.type==='global'&&c.locale===locale);assert.equal(g.data.resume,undefined);assert.equal(g.data.contact.email,undefined);assert.equal(g.data.socialLinks.length,1);}
});
test('review digests bind content, schema and complete SQL inventory; tampering conflicts fail closed',async()=>{
  const f=fixture(),plan=seeder.buildPlan(await f.inventory());assert.deepEqual(plan.conflicts,[]);seeder.validatePlan(plan,plan.digest);const changed=structuredClone(plan);changed.records[0].data.siteName='tampered';assert.throws(()=>seeder.validatePlan(changed,plan.digest));const duplicate=await f.inventory();duplicate.snapshots.services=[{id:2,document_id:'one',slug:'full-stack-development',locale:'en'},{id:3,document_id:'two',slug:'full-stack-development',locale:'ar'}];assert.ok(seeder.buildPlan(duplicate).conflicts.length);
});
test('atomic bilingual creation/publication preserves projects/Angular and idempotent reruns skip all content',async()=>{
  const f=fixture(),plan=seeder.buildPlan(await f.inventory()),authorization=await authorized(plan);const protectedProject=structuredClone(f.state().projects),angular=structuredClone(f.state().technologies[0]);const result=await seeder.seed(f.strapi,plan,{confirmPlan:plan.digest,authorization,confirmProduction:true,publish:true});assert.equal(result.committed,true);assert.equal(result.events.filter(e=>e.status==='published').length,30);assert.deepEqual(f.state().projects,protectedProject);assert.deepEqual(f.state().technologies[0],angular);assert.equal(f.state().technologies.length,14);
  const next=seeder.buildPlan(await f.inventory());assert.ok(next.records.every(r=>r.action==='skip-existing'&&r.publication==='skip-published'));const count=JSON.stringify(f.state());await seeder.seed(f.strapi,next,{confirmPlan:next.digest,authorization:await authorized(next),confirmProduction:true,publish:true});assert.equal(JSON.stringify(f.state()),count);
});
test('publication errors roll back every draft/technology and stale inventories abort before mutation',async()=>{
  const f=fixture(),plan=seeder.buildPlan(await f.inventory()),before=JSON.stringify(f.state());f.fail();await assert.rejects(seeder.seed(f.strapi,plan,{confirmPlan:plan.digest,authorization:await authorized(plan),confirmProduction:true,publish:true}));assert.equal(JSON.stringify(f.state()),before);
  f.state().projects.push({id:99});const drifted=JSON.stringify(f.state());await assert.rejects(seeder.seed(f.strapi,plan,{confirmPlan:plan.digest,authorization:await authorized(plan),confirmProduction:true,publish:true}));assert.equal(JSON.stringify(f.state()),drifted);
});
test('unverified backup authorization is refused and existing drafts are never published or overwritten',async()=>{
  const f=fixture(),inv=await f.inventory();inv.snapshots.globals.push({id:5,document_id:'existing',seed_key:'portfolio',locale:'en'});const plan=seeder.buildPlan(inv);assert.equal(plan.records.find(r=>r.type==='global'&&r.locale==='en').publication,'skip-unapproved-existing-draft');await assert.rejects(seeder.seed(f.strapi,plan,{confirmPlan:plan.digest,authorization:{target:inv.target},confirmProduction:true,publish:true}));
});
test('post-commit public API verification checks all eight locale/model endpoints and rejects drafts',async()=>{
  const fetcher=async url=>{const locale=url.searchParams.get('locale'),model=url.pathname.split('/').pop(),count=model==='services'?6:model==='experiences'?7:1;const rows=Array.from({length:count},(_,i)=>({documentId:`fixture-${i}`,locale,publishedAt:'2026-01-01',enabled:true}));return{ok:true,json:async()=>({data:count===1?rows[0]:rows})};};
  assert.equal((await seeder.verifyApi('https://api.example.com',fetcher)).length,8);
  await assert.rejects(seeder.verifyApi('https://api.example.com',async()=>({ok:true,json:async()=>({data:{documentId:'fixture',locale:'en',publishedAt:null,enabled:true}})})));
});
test('SQL inventory normalizes JSON text/object driver differences without losing nested values',async()=>{
  const f=fixture(),before=await f.inventory();
  const textual=await seeder.inventory(async(sql,params)=>{const result=await f.query(sql,params);return sql.startsWith('select row_to_json')?{rows:result.rows.map(r=>({row:JSON.stringify(r.row)}))}:result;},config);
  assert.equal(legacy.digest(before),legacy.digest(textual));
});
