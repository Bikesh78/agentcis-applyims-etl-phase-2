import { ApplyIMSApiClient } from '../loaders/api-client.js';

export enum EntityType {
  USERS = 'users',
  CONTACTS = 'contacts',
  APPLICATIONS = 'applications',
  NOTES = 'notes',
  DEALS = 'deals',
  OFFICE_VISITS = 'office-visits',
  ATTACHMENTS = 'attachments',
  AGENTS = 'agents',
  CONTACT_ACTIVITIES = 'contact-activities',
}

export const ENTITY_API_METHOD_MAP: Partial<Record<EntityType, keyof ApplyIMSApiClient>> = {
  [EntityType.USERS]: 'bulkCreateUsers',
  [EntityType.CONTACTS]: 'bulkCreateContacts',
  [EntityType.APPLICATIONS]: 'bulkCreateApplications',
  [EntityType.DEALS]: 'bulkCreateDeals',
  [EntityType.OFFICE_VISITS]: 'bulkCreateOfficeVisits',
  [EntityType.ATTACHMENTS]: 'bulkCreateMedia',
  [EntityType.AGENTS]: 'bulkCreateAgents',
  [EntityType.CONTACT_ACTIVITIES]: 'bulkCreateContactActivities',
  [EntityType.NOTES]: 'bulkCreateNotes',
};

export const SUPPORTED_ENTITIES = Object.values(EntityType);

export const ENTITY_DEPENDENCY_ORDER: EntityType[] = [
  EntityType.USERS,
  EntityType.AGENTS,
  EntityType.CONTACTS,
  EntityType.DEALS,
  EntityType.APPLICATIONS,
  EntityType.NOTES,
  EntityType.CONTACT_ACTIVITIES,
  EntityType.OFFICE_VISITS,
  EntityType.ATTACHMENTS,
];
