const test=require('node:test'),assert=require('node:assert/strict');
const {candidates,seed}=require('../scripts/seed-projects.cjs');
const project=require('../src/api/project/content-types/project/schema.json');
const technology=require('../src/api/technology/content-types/technology/schema.json');
test('Schema uses localization, publication and reciprocal technology relations',()=>{assert.equal(project.options.draftAndPublish,true);assert.equal(project.pluginOptions.i18n.localized,true);assert.equal(project.attributes.slug.pluginOptions.i18n.localized,false);assert.equal(project.attributes.technologies.inversedBy,'projects');assert.equal(technology.attributes.projects.mappedBy,'technologies');});
test('Draft seeding links locales, does not publish, and is idempotent',async()=>{
 const records=[],updates=[],tech=[];
 const projectService={findFirst:async({filters})=>records.find(r=>r.slug===filters.slug),create:async({data,locale,status})=>{assert.equal(status,'draft');const r={...data,locale,documentId:String(records.length+1)};records.push(r);return r;},update:async request=>{assert.equal(request.status,'draft');updates.push(request);}};
 const techService={findFirst:async()=>tech[0],create:async({data})=>{const r={...data,documentId:'angular-id'};tech.push(r);return r;}};
 const app={plugin:()=>({service:()=>({find:async()=>[{code:'en'},{code:'ar'}]})}),documents:uid=>uid.includes('technology')?techService:projectService};
 await seed(app);await seed(app);assert.equal(records.length,3);assert.equal(updates.length,3);assert.equal(tech.length,1);
 for(const update of updates){assert.equal(update.locale,'ar');assert.ok(records.some(record=>record.documentId===update.documentId));}
 for(const record of records){assert.equal(record.featured,false);for(const field of ['myRole','projectYear','demoUrl','repositoryUrl','coverImage','clientName'])assert.equal(record[field],undefined);}
 assert.equal(candidates.length,3);
});
