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
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'varchar', length: 36 })
  migrationId: string;

  @ManyToOne(() => MigrationJob, (m) => m.checkpoints)
  @JoinColumn({ name: 'migration_id' })
  migration: MigrationJob;

  @Column({ type: 'varchar', length: 50 })
  entityType: string;

  @Column({ type: 'int', nullable: true })
  totalCount?: number;

  @Column({ type: 'int', default: 0, nullable: true })
  processedCount?: number;

  @Column({ type: 'int', default: 0, nullable: true })
  successCount?: number;

  @Column({ type: 'int', default: 0, nullable: true })
  failedCount?: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  lastProcessedId?: string;

  @Column({ type: 'timestamp', nullable: true })
  startedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt?: Date;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
