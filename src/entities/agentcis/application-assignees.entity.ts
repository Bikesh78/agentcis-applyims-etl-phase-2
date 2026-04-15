import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Applications } from './applications.entity.js';

@Entity('applications_assignees')
export class ApplicationAssignees {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'assignee_id', type: 'int' })
  assigneeId: number;

  @ManyToOne(() => Applications, (application) => application.applicationAssignees)
  @JoinColumn({ name: 'application_id' })
  application: Applications;

  // @Column({ name: 'application_id', type: 'int' })
  // applicationId: number;

  @Column({ name: 'added_by', type: 'int' })
  addedBy: number;

  // @Column({ name: 'created_at', type: 'timestamp', nullable: true })
  // createdAt: Date | null;
  //
  // @Column({ name: 'updated_at', type: 'timestamp', nullable: true })
  // updatedAt: Date | null;
  //
  // @Column({ name: 'ownership_ratio', type: 'decimal', precision: 5, scale: 2, nullable: true })
  // ownershipRatio: number | null;
  //
  // @Column({ name: 'is_owner', type: 'tinyint', nullable: true })
  // isOwner: boolean | null;
}
