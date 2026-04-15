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
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Index()
  @Column({ type: 'varchar', length: 36, name: 'migration_id' })
  migrationId: string;

  @ManyToOne(() => MigrationJob, (m) => m.metrics)
  @JoinColumn({ name: 'migration_id' })
  migration: MigrationJob;

  @Index()
  @Column({ type: 'varchar', length: 50, nullable: true, name: 'metric_type' })
  metricType?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, name: 'metric_value' })
  metricValue?: number;

  @Index()
  @CreateDateColumn({ type: 'timestamp', name: 'recorded_at' })
  recordedAt: Date;
}
