import {
  ApplyIMSActivitiesActionType,
  ApplyIMSActivitiesJsonField,
  ApplyIMSActivitiesType,
} from 'types/activities-type.js';

export interface ApplyIMSContactActivity {
  id: string;
  activitiesTypeId: string | null;
  activitiesType: ApplyIMSActivitiesType;
  activitiesAction: ApplyIMSActivitiesActionType;
  // data: unknown | null;
  data: ApplyIMSActivitiesJsonField;
  userId: string;
  contactId: string;
  previousAssignedUserId: string | null;
  assignedUserId: string | null;
  followerUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
