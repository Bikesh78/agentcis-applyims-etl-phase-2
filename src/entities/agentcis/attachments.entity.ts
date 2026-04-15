import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export type AttachmentableType =
  | 'application_stage'
  | 'client'
  | 'document_checklist'
  | 'email'
  | 'partner'
  | 'product'
  | 'regulatory_supporting_document'
  | 'task';

@Entity('attachments')
export class Attachment {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'original_name' })
  originalName: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'path' })
  path: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'type' })
  type: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'attachmentable_type' })
  attachmentableType: AttachmentableType;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'description' })
  description: string;

  @Column({ type: 'int', unsigned: true, nullable: true, name: 'uploader' })
  uploader: number;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'uploader_type' })
  uploaderType: string;

  @Column({ type: 'int', name: 'attachmentable_id' })
  attachmentableId: number;

  @Column({ type: 'int', name: 'file_size' })
  fileSize: number;

  @CreateDateColumn({ type: 'timestamp', nullable: true, name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', nullable: true, name: 'updated_at' })
  updatedAt: Date;
}
