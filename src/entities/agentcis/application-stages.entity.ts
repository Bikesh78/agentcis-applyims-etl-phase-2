import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApplicationActivities } from './application-activities.entity.js';
import { Applications } from './applications.entity.js';

@Entity('application_stages')
export class ApplicationStages {
  @ManyToOne(() => Applications, (application) => application.applicationStages)
  @JoinColumn({ name: 'application_id' })
  application: Applications | null;

  @OneToMany(() => ApplicationActivities, (activity) => activity.applicationStage)
  applicationActivities: ApplicationActivities[];

  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ type: 'int', unsigned: true, name: 'application_id' })
  applicationId: number;

  @Column({ type: 'int', unsigned: true, name: 'stage_id' })
  stageId: number;

  @Column({ type: 'timestamp', nullable: true, name: 'due_date' })
  dueDate: Date | null;

  @CreateDateColumn({ type: 'timestamp', nullable: true, name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', nullable: true, name: 'updated_at' })
  updatedAt: Date;
}
