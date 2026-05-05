import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApplicationStages } from './application-stages.entity.js';

@Entity('application_activities')
export class ApplicationActivities {
  @ManyToOne(() => ApplicationStages, () => {})
  @JoinColumn({ name: 'application_stage_id' })
  applicationStage: ApplicationStages;

  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  // @Column({ type: 'int', unsigned: true, name: 'application_stage_id' })
  // applicationStageId: number;

  @Column({ type: 'int', unsigned: true, name: 'user_id' })
  userId: number;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'type' })
  type: string | null;

  @Column({ type: 'text', nullable: true, name: 'description' })
  description: string | null;

  @CreateDateColumn({ type: 'timestamp', nullable: true, name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', nullable: true, name: 'updated_at' })
  updatedAt: Date;
}
