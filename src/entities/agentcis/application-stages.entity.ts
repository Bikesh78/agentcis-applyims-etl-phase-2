import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Applications } from './applications.entity.js';

@Entity('application_stages')
export class ApplicationStages {
  @ManyToOne(() => Applications, () => {})
  @JoinColumn({ name: 'application_id' })
  application: Applications;

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
