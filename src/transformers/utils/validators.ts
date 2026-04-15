import Joi from 'joi';

export const isEmail = (email: string): boolean => {
  const emailSchema = Joi.string().email();
  return !emailSchema.validate(email).error;
};

export const isUuid = (id: string): boolean => {
  const uuidSchema = Joi.string().guid({ version: 'uuidv4' });
  return !uuidSchema.validate(id).error;
};

export const isDate = (date: string): boolean => {
  const schema = Joi.date();
  return !schema.validate(date).error;
};

export const isNumeric = (value: string): boolean => {
  const schema = Joi.number();
  return !schema.validate(value).error;
};
