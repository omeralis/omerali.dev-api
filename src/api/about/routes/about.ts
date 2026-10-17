import { factories } from '@strapi/strapi';
export default factories.createCoreRouter('api::about.about', { only: ['find', 'findOne'], config: { find: { auth: false }, findOne: { auth: false } } });
