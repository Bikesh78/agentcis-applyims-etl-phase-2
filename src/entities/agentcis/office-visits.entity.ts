import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { OfficeVisitsAssignees } from './office-visits-assignees.entity.js';

@Entity('office_visits')
export class OfficeVisits {
  @OneToMany(
    () => OfficeVisitsAssignees,
    (officeVisitAssignees) => officeVisitAssignees.officeVisit
  )
  officeVisitAssignees: OfficeVisitsAssignees[];

  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'contact_id', type: 'int' })
  contactId: number;

  @Column({ name: 'office_id', type: 'int' })
  officeId: number;

  @Column({ name: 'assignee_id', type: 'int' })
  assigneeId: number;

  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'visit_purpose', type: 'varchar' })
  visitPurpose: string;
}
