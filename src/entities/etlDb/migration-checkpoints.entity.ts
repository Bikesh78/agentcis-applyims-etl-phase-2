import {
  Unique,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MigrationJob } from './migration-jobs.entity.js';

@Entity('migration_checkpoints')
@Unique(['migrationId', 'entityType'])
export class MigrationCheckpoint {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Column({ type: 'varchar', length: 36, name: 'migration_id' })
  migrationId: string;

  @ManyToOne(() => MigrationJob, (m) => m.checkpoints)
  @JoinColumn({ name: 'migration_id' })
  migration: MigrationJob;

  @Column({ type: 'varchar', length: 50, name: 'entity_type' })
  entityType: string;

  @Column({ type: 'int', nullable: true, name: 'total_count' })
  totalCount?: number;

  @Column({ type: 'int', default: 0, nullable: true, name: 'processed_count' })
  processedCount?: number;

  @Column({ type: 'int', default: 0, nullable: true, name: 'success_count' })
  successCount?: number;

  @Column({ type: 'int', default: 0, nullable: true, name: 'failed_count' })
  failedCount?: number;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'last_processed_id' })
  lastProcessedId?: string;

  @Column({ type: 'timestamp', nullable: true, name: 'started_at' })
  startedAt?: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'completed_at' })
  completedAt?: Date;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
  updatedAt: Date;
}
