'use strict';
const source = require('./portfolio-candidates.json');
const slug = value => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const names = new Map();
for (const group of source.locales.en.home.about.stack) for (const name of [...group.primary, ...group.supporting]) names.set(name, group.category);
const catalog = [...names].map(([name, category], index) => ({ name, category, slug: slug(name), displayOrder: index + 1 }));
const candidates = [];
for (const locale of ['en', 'ar']) {
  const s = source.locales[locale], h = s.home;
  const global = { seedKey: 'portfolio', enabled: true, siteName: s.identity.name, siteDescription: s.identity.description, professionalTitle: s.identity.title, careerStart: s.identity.careerStart, hero: { ...h.hero, headline: h.hero.headline.map(value => ({ value })) }, contact: s.contact, socialLinks: [{ key: 'linkedin', label: 'LinkedIn', url: h.hero.links.linkedin, enabled: true, displayOrder: 1 }], servicesIntroduction: s.services.introduction, experienceIntroduction: s.experience.introduction };
  delete global.hero.links;
  candidates.push({ type: 'global', key: 'portfolio', locale, data: global });
  candidates.push({ type: 'about', key: 'portfolio', locale, data: { seedKey: 'portfolio', enabled: true, title: h.about.heading, identifier: h.about.identifier, paragraphs: h.about.paragraphs.map(value => ({ value })), details: h.about.details, stackHeading: h.about.stackHeading, primaryLabel: h.about.primaryLabel, supportingLabel: h.about.supportingLabel, stack: h.about.stack.map(group => ({ category: group.category, items: [...group.primary.map(name => ({ technology: slug(name), primary: true })), ...group.supporting.map(name => ({ technology: slug(name), primary: false }))] })) } });
  for (const service of s.services.services) candidates.push({ type: 'service', key: service.slug, locale, data: { slug: service.slug, enabled: true, title: locale === 'ar' ? service.titleArabic : service.title, description: locale === 'ar' ? service.descriptionArabic : service.description, number: service.number, displayOrder: service.displayOrder } });
  for (const entry of s.experience.entries) {
    const data = { slug: entry.id, enabled: true, title: locale === 'ar' ? entry.roleArabic || entry.role : entry.role, company: locale === 'ar' ? entry.companyArabic || entry.company : entry.company, role: locale === 'ar' ? entry.roleArabic || entry.role : entry.role, employmentType: entry.employmentType, startDate: entry.startDate, isCurrent: entry.isCurrent, displayOrder: entry.displayOrder };
    for (const key of ['endDate', 'workMode', 'associatedOrganization']) if (entry[key]) data[key] = entry[key];
    if (entry.location) data.location = locale === 'ar' ? entry.locationArabic || entry.location : entry.location;
    candidates.push({ type: 'experience', key: entry.id, locale, data });
  }
}
module.exports = { source, catalog, candidates };
