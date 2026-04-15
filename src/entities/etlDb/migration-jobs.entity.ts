import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { MigrationCheckpoint } from './migration-checkpoints.entity.js';
import { MigrationError } from './migration-errors.entity.js';
import { MigrationMetric } from './migration-metrics.entity.js';

export enum MigrationStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('migration_jobs')
export class MigrationJob {
  @PrimaryColumn({ type: 'varchar', length: 36, name: 'id' })
  id: string;

  @Column({ type: 'enum', enum: MigrationStatus, name: 'status' })
  status: MigrationStatus;

  @Column({ type: 'jsonb', nullable: true, name: 'config' })
  config?: object;

  @Column({ type: 'timestamp', nullable: true, name: 'started_at' })
  startedAt?: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'completed_at' })
  completedAt?: Date;

  @Column({ type: 'text', nullable: true, name: 'error_message' })
  errorMessage?: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'created_by' })
  createdBy?: string;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => MigrationCheckpoint, (c) => c.migration)
  checkpoints: MigrationCheckpoint[];

  @OneToMany(() => MigrationError, (e) => e.migration)
  errors: MigrationError[];

  @OneToMany(() => MigrationMetric, (m) => m.migration)
  metrics: MigrationMetric[];
}
