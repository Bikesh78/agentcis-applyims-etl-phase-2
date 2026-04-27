import { ApplyIMSApiClient } from '../loaders/api-client.js';

export enum EntityType {
  CONTACTS = 'contacts',
  APPLICATIONS = 'applications',
  DEALS = 'deals',
  OFFICE_VISITS = 'office-visits',
  ATTACHMENTS = 'attachments',
}

export const ENTITY_API_METHOD_MAP: Partial<Record<EntityType, keyof ApplyIMSApiClient>> = {
  [EntityType.CONTACTS]: 'bulkCreateContacts',
  [EntityType.APPLICATIONS]: 'bulkCreateApplications',
  [EntityType.DEALS]: 'bulkCreateDeals',
  [EntityType.OFFICE_VISITS]: 'bulkCreateOfficeVisits',
  [EntityType.ATTACHMENTS]: 'bulkCreateMedia',
};

export const SUPPORTED_ENTITIES = Object.values(EntityType);

export const ENTITY_DEPENDENCY_ORDER: EntityType[] = [
  EntityType.CONTACTS,
  EntityType.DEALS,
  EntityType.APPLICATIONS,
  EntityType.OFFICE_VISITS,
  EntityType.ATTACHMENTS,
];
