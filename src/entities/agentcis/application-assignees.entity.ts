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

  @Column({ name: 'application_id', type: 'int' })
  applicationId: number;

  @Column({ name: 'added_by', type: 'int' })
  addedBy: number;
}
