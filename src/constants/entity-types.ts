import { ApplyIMSApiClient } from '../loaders/api-client.js';

export enum EntityType {
  CONTACTS = 'contacts',
  APPLICATIONS = 'applications',
  DEALS = 'deals',
  OFFICE_VISITS = 'office-visits',
  ATTACHMENTS = 'attachments',
  REFERRERS = 'referrers',
}

export const ENTITY_EXTRACTOR_MAP: Record<EntityType, string> = {
  [EntityType.CONTACTS]: 'ContactExtractor',
  [EntityType.APPLICATIONS]: 'ApplicationExtractor',
  [EntityType.DEALS]: 'DealExtractor',
  [EntityType.OFFICE_VISITS]: 'OfficeVisitsExtractor',
  [EntityType.ATTACHMENTS]: 'AttachmentExtractor',
  [EntityType.REFERRERS]: 'ReferrerExtractor',
};

export const ENTITY_TRANSFORMER_MAP: Record<EntityType, string> = {
  [EntityType.CONTACTS]: 'ContactTransformer',
  [EntityType.APPLICATIONS]: 'ApplicationTransformer',
  [EntityType.DEALS]: 'DealTransformer',
  [EntityType.OFFICE_VISITS]: 'OfficeVisitTransformer',
  [EntityType.ATTACHMENTS]: 'AttachmentTransformer',
  [EntityType.REFERRERS]: 'ReferrerTransformer',
};

export const ENTITY_API_METHOD_MAP: Partial<Record<EntityType, keyof ApplyIMSApiClient>> = {
  [EntityType.CONTACTS]: 'bulkCreateContacts',
  [EntityType.APPLICATIONS]: 'bulkCreateApplications',
  [EntityType.DEALS]: 'bulkCreateDeals',
  [EntityType.OFFICE_VISITS]: 'bulkCreateOfficeVisits',
  [EntityType.ATTACHMENTS]: 'bulkCreateMedia',
};

export const SUPPORTED_ENTITIES = Object.values(EntityType);
