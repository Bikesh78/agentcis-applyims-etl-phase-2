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
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ type: 'enum', enum: MigrationStatus })
  status: MigrationStatus;

  @Column({ type: 'jsonb', nullable: true })
  config?: object;

  @Column({ type: 'timestamp', nullable: true })
  startedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt?: Date;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  createdBy?: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  @OneToMany(() => MigrationCheckpoint, (c) => c.migration)
  checkpoints: MigrationCheckpoint[];

  @OneToMany(() => MigrationError, (e) => e.migration)
  errors: MigrationError[];

  @OneToMany(() => MigrationMetric, (m) => m.migration)
  metrics: MigrationMetric[];
}
