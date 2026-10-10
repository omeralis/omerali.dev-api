const candidates = [
  { slug: 'grc-platform', projectType: 'Enterprise', en: { title: 'GRC Platform', shortDescription: 'A Governance, Risk and Compliance platform involving organizational risks, controls, compliance processes, assessments, dashboards and reporting.', features: ['Risk and compliance management', 'Controls', 'Dashboards', 'Reporting', 'Role-based permissions'] }, ar: { title: 'منصة GRC', shortDescription: 'منصة للحوكمة والمخاطر والامتثال تشمل المخاطر المؤسسية والضوابط وإجراءات الامتثال والتقييمات ولوحات المعلومات والتقارير.', features: ['إدارة المخاطر والامتثال', 'الضوابط', 'لوحات المعلومات', 'التقارير', 'صلاحيات الوصول وفق الأدوار'] }, angular: true },
  { slug: 'cyber-imtithal', projectType: 'Business', en: { title: 'Cyber Imtithal', shortDescription: 'A platform involving contract management, interactive maps, follow-up workflows and approval processes.', features: ['Contract management', 'Interactive maps', 'Follow-up workflows', 'Approval processes', 'Attachments', 'PDF reports', 'Dashboards', 'Role-based permissions', 'Arabic and English localization'] }, ar: { title: 'Cyber Imtithal', shortDescription: 'منصة تشمل إدارة العقود والخرائط التفاعلية وسير عمل المتابعة وإجراءات الاعتماد.', features: ['إدارة العقود', 'الخرائط التفاعلية', 'سير عمل المتابعة', 'إجراءات الاعتماد', 'المرفقات', 'تقارير PDF', 'لوحات المعلومات', 'صلاحيات الوصول وفق الأدوار', 'التوطين بالعربية والإنجليزية'] } },
  { slug: 'investor-vendor-portal', projectType: 'Business', en: { title: 'Investor / Vendor Portal', shortDescription: 'A portal involving user and vendor registration, business information and workflow management.', features: ['User registration', 'Vendor registration', 'Multi-step forms', 'Document uploads', 'Business information', 'Form validation', 'Workflow management'] }, ar: { title: 'بوابة المستثمرين والموردين', shortDescription: 'بوابة تشمل تسجيل المستخدمين والموردين وبيانات الأعمال وإدارة سير العمل.', features: ['تسجيل المستخدمين', 'تسجيل الموردين', 'النماذج متعددة الخطوات', 'رفع المستندات', 'بيانات الأعمال', 'التحقق من صحة النماذج', 'إدارة سير العمل'] } },
];
function localizedData(candidate, locale, index, angular) {
 const data=candidate[locale];
 return { title:data.title, slug:candidate.slug, shortDescription:data.shortDescription, projectType:candidate.projectType, featured:false, displayOrder:index, features:data.features.map((title,displayOrder)=>({title,displayOrder})), ...(angular&&candidate.angular?{technologies:[angular.documentId]}:{}) };
}
async function seed(strapi) {
 const locales=await strapi.plugin('i18n').service('locales').find();
 if(!['en','ar'].every(code=>locales.some(locale=>locale.code===code))) throw new Error('Configure English and Arabic locales before seeding.');
 const projects=strapi.documents('api::project.project');
 let angular;
 for(const [index,candidate] of candidates.entries()) {
  // Do not edit either existing published records or their draft versions.
  const existing=await projects.findFirst({locale:'en',status:'draft',filters:{slug:candidate.slug}})
    || await projects.findFirst({locale:'ar',status:'draft',filters:{slug:candidate.slug}});
  if(existing){console.log(`Skipped existing candidate: ${candidate.slug}`);continue;}
  if(candidate.angular&&!angular){const technologies=strapi.documents('api::technology.technology');angular=await technologies.findFirst({filters:{slug:'angular'}})||await technologies.findFirst({filters:{name:'Angular'}})||await technologies.create({data:{name:'Angular',slug:'angular',category:'Frontend',displayOrder:0}});}
  const english=await projects.create({locale:'en',status:'draft',data:localizedData(candidate,'en',index,angular)});
  await projects.update({documentId:english.documentId,locale:'ar',status:'draft',data:localizedData(candidate,'ar',index,angular)});
  console.log(`Created linked drafts: ${candidate.slug}`);
 }
}
if(require.main===module) {
 if(!process.argv.includes('--apply')) { console.log('Dry run only. These incomplete candidates remain unpublished:');console.log(JSON.stringify(candidates,null,2)); }
 else if(process.env.NODE_ENV==='production') { console.error('Production seeding is disabled. Review and import drafts manually through the CMS.');process.exitCode=1; }
 else { const {createStrapi,compileStrapi}=require('@strapi/strapi');(async()=>{const app=createStrapi(await compileStrapi());try{await app.load();await seed(app);}finally{await app.destroy();}})().catch(()=>{console.error('Draft seed failed. No records are published by this script.');process.exitCode=1;}); }
}
module.exports={candidates,seed,localizedData};
