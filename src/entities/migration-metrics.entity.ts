import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { MigrationJob } from './migration-jobs.entity.js';

@Entity('migration_metrics')
export class MigrationMetric {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  migrationId: string;

  @ManyToOne(() => MigrationJob, (m) => m.metrics)
  @JoinColumn({ name: 'migration_metrics' })
  migration: MigrationJob;

  @Index()
  @Column({ type: 'varchar', length: 50, nullable: true })
  metricType?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  metricValue?: number;

  @Index()
  @CreateDateColumn({ type: 'timestamp' })
  recordedAt: Date;
}
