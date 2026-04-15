import Joi from 'joi';

export interface S3BucketConfig {
  awsBucketTenant: string;
  awsDestinationBucket: string;
  awsRegion: string;
}

export const s3BucketConfigSchema = Joi.object<S3BucketConfig>({
  awsBucketTenant: Joi.string().required().messages({
    'any.required': 'AWS_BUCKET_TENANT is required',
  }),
  awsDestinationBucket: Joi.string().required().messages({
    'any.required': 'AWS_DESTINATION_BUCKET is required',
  }),
  awsRegion: Joi.string().required().messages({
    'any.required': 'AWS_REGION is required',
  }),
});
