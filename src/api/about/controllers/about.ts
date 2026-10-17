import { factories } from '@strapi/strapi';
export default factories.createCoreController('api::about.about', () => ({
  async find(ctx) { ctx.query = { ...ctx.query, status: 'published', filters: { $and: [ctx.query.filters || {}, { enabled: { $eq: true } }] } }; return super.find(ctx); },
  async findOne(ctx) { ctx.query = { ...ctx.query, status: 'published', filters: { $and: [ctx.query.filters || {}, { enabled: { $eq: true } }] } }; return super.findOne(ctx); },
}));
