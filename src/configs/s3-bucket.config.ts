import Joi from 'joi';

export interface S3BucketConfig {
  awsSourceBucket: string;
  awsDestinationBucket: string;
  awsRegion: string;
}

export const s3BucketConfigSchema = Joi.object<S3BucketConfig>({
  awsSourceBucket: Joi.string().required().messages({
    'any.required': 'AWS_SOURCE_BUCKET is required',
  }),
  awsDestinationBucket: Joi.string().required().messages({
    'any.required': 'AWS_DESTINATION_BUCKET is required',
  }),
  awsRegion: Joi.string().required().messages({
    'any.required': 'AWS_REGION is required',
  }),
});
