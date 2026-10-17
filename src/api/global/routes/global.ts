import { factories } from '@strapi/strapi';
export default factories.createCoreRouter('api::global.global', { only: ['find', 'findOne'], config: { find: { auth: false }, findOne: { auth: false } } });
