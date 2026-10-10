import { factories } from '@strapi/strapi';

// The portfolio Content API never exposes drafts, even with a read-only token.
export default factories.createCoreController('api::project.project', () => ({
  async find(ctx) { ctx.query = { ...ctx.query, status: 'published' }; return super.find(ctx); },
  async findOne(ctx) { ctx.query = { ...ctx.query, status: 'published' }; return super.findOne(ctx); },
}));
