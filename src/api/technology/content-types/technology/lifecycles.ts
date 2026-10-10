import { errors } from '@strapi/utils';
function validate(event) {
  const name = event.params.data.name;
  if (typeof name === 'string' && /\.net|dotnet|asp\.net/i.test(name)) throw new errors.ValidationError('Technology is outside the approved catalog.');
}
export default { beforeCreate: validate, beforeUpdate: validate };
