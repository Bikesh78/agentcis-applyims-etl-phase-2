export type MediaType = 'Supporting Documents';
export type MediaTypeCategory = 'Other Documents';
export type SubjectType = 'ContactMedia' | 'ApplicationMedia';

export interface ApplyIMSMedia {
  id: string;
  name: string | null;
  path: string | null;
  size: number;
  mimetype: string;
  subjectId: string | null;
  subjectType: SubjectType | null;
  mediaType: MediaType | null;
  mediaTypeCategory: MediaTypeCategory | null;
  extension: string | null;
  isDeleted: boolean;
  createdBy: string | null;
  bucketFileName: string;
  createdAt: Date | null;
  updatedAt: Date | null;
  // syncId: string | null;
  stageId: string | null;
  // isDeletedFromApplication: boolean;
}
