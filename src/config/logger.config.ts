// import Joi from 'joi';
//
// export type LoggerLevel = 'error' | 'warn' | 'info';
//
// export interface LoggerConfig {
//   level: LoggerLevel;
// }
//
// export const loggerConfigSchema = Joi.object<LoggerConfig>({
//   level: Joi.string().valid('error', 'warn', 'info').required().messages({
//     'any.only': 'Logger level must be one of: error, warn, info',
//     'any.required': 'Logger level is required',
//   }),
// });
