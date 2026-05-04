export interface ApplyIMSContactActivity {
  id: string;
  activitiesTypeId: string | null;
  activitiesType: string | null;
  activitiesAction: string | null;
  data: unknown | null;
  userId: string;
  contactId: string;
  previousAssignedUserId: string | null;
  assignedUserId: string | null;
  followerUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
