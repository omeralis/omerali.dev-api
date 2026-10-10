const candidates = [
  { slug: 'grc-platform', projectType: 'Enterprise', en: { title: 'GRC Platform', shortDescription: 'A Governance, Risk and Compliance platform involving organizational risks, controls, compliance processes, assessments, dashboards and reporting.', features: ['Risk and compliance management', 'Controls', 'Dashboards', 'Reporting', 'Role-based permissions'] }, ar: { title: 'منصة GRC', shortDescription: 'منصة للحوكمة والمخاطر والامتثال تشمل المخاطر المؤسسية والضوابط وإجراءات الامتثال والتقييمات ولوحات المعلومات والتقارير.', features: ['إدارة المخاطر والامتثال', 'الضوابط', 'لوحات المعلومات', 'التقارير', 'صلاحيات الوصول وفق الأدوار'] }, angular: true },
  { slug: 'cyber-imtithal', projectType: 'Business', en: { title: 'Cyber Imtithal', shortDescription: 'A platform involving contract management, interactive maps, follow-up workflows and approval processes.', features: ['Contract management', 'Interactive maps', 'Follow-up workflows', 'Approval processes', 'Attachments', 'PDF reports', 'Dashboards', 'Role-based permissions', 'Arabic and English localization'] }, ar: { title: 'Cyber Imtithal', shortDescription: 'منصة تشمل إدارة العقود والخرائط التفاعلية وسير عمل المتابعة وإجراءات الاعتماد.', features: ['إدارة العقود', 'الخرائط التفاعلية', 'سير عمل المتابعة', 'إجراءات الاعتماد', 'المرفقات', 'تقارير PDF', 'لوحات المعلومات', 'صلاحيات الوصول وفق الأدوار', 'التوطين بالعربية والإنجليزية'] } },
  { slug: 'investor-vendor-portal', projectType: 'Business', en: { title: 'Investor / Vendor Portal', shortDescription: 'A portal involving user and vendor registration, business information and workflow management.', features: ['User registration', 'Vendor registration', 'Multi-step forms', 'Document uploads', 'Business information', 'Form validation', 'Workflow management'] }, ar: { title: 'بوابة المستثمرين والموردين', shortDescription: 'بوابة تشمل تسجيل المستخدمين والموردين وبيانات الأعمال وإدارة سير العمل.', features: ['تسجيل المستخدمين', 'تسجيل الموردين', 'النماذج متعددة الخطوات', 'رفع المستندات', 'بيانات الأعمال', 'التحقق من صحة النماذج', 'إدارة سير العمل'] } },
];
const descriptions = {
  'grc-platform': {
    en: ['A Governance, Risk and Compliance platform covering organizational risks, controls, compliance processes and assessments.', 'The platform includes dashboards, reporting and role-based permissions. Angular is a confirmed technology for this project.'],
    ar: ['منصة للحوكمة والمخاطر والامتثال تشمل المخاطر المؤسسية والضوابط وإجراءات الامتثال والتقييمات.', 'تتضمن المنصة لوحات معلومات وتقارير وصلاحيات وصول وفق الأدوار. Angular من التقنيات المؤكدة لهذا المشروع.'],
  },
  'cyber-imtithal': {
    en: ['A platform involving contract management, interactive maps, follow-up workflows and approval processes.', 'Its capabilities include attachments, PDF reports, dashboards, role-based permissions and Arabic / English localization.'],
    ar: ['منصة تشمل إدارة العقود والخرائط التفاعلية وسير عمل المتابعة وإجراءات الاعتماد.', 'تشمل قدراتها المرفقات وتقارير PDF ولوحات المعلومات وصلاحيات الوصول وفق الأدوار والتوطين بالعربية والإنجليزية.'],
  },
  'investor-vendor-portal': {
    en: ['A portal involving user registration, vendor registration and business information.', 'The portal includes multi-step forms, document uploads, form validation and workflow management.'],
    ar: ['بوابة تشمل تسجيل المستخدمين والموردين وبيانات الأعمال.', 'تتضمن البوابة نماذج متعددة الخطوات ورفع المستندات والتحقق من صحة النماذج وإدارة سير العمل.'],
  },
};
const technologies = [{ name: 'Angular', slug: 'angular', category: 'Frontend', displayOrder: 1 }];
for (const [index, candidate] of candidates.entries()) {
  candidate.displayOrder = index + 1;
  candidate.technologies = candidate.angular ? ['angular'] : [];
  delete candidate.angular;
  for (const locale of ['en', 'ar']) {
    candidate[locale].description = descriptions[candidate.slug][locale].map(text => ({ type: 'paragraph', children: [{ type: 'text', text }] }));
    candidate[locale].seo = { metaTitle: candidate[locale].title, metaDescription: candidate[locale].shortDescription };
  }
}
module.exports = { candidates, technologies };
