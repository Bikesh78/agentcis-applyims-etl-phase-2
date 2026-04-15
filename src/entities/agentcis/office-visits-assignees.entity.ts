import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { OfficeVisits } from './office-visits.entity.js';

@Entity('office_visits_assignees')
export class OfficeVisitsAssignees {
  @ManyToOne(() => OfficeVisits, (officeVisits) => officeVisits.officeVisitAssignees)
  @JoinColumn({ name: 'office_visit_id' })
  officeVisit: OfficeVisits;

  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'office_visit_id', type: 'int' })
  officeVisitId: number;

  @Column({ name: 'assignee_id', type: 'int' })
  assigneeId: number;

  @Column({ name: 'assigned_on', type: 'datetime' })
  assignedOn: string;

  @Column({ name: 'attended_on', type: 'datetime' })
  attendedOn: string;

  @Column({ name: 'completed_on', type: 'datetime' })
  completedOn: string;
}
