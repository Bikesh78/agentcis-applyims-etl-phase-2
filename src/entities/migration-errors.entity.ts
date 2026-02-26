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

@Entity('migration_errors')
export class MigrationError {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  migrationId: string;

  @ManyToOne(() => MigrationJob, (m) => m.errors)
  @JoinColumn({ name: 'migration_id' })
  migration: MigrationJob;

  @Index()
  @Column({ type: 'varchar', length: 50 })
  entityType: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  entityId?: string;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ type: 'jsonb', nullable: true })
  errorDetails?: object;

  @Column({ type: 'jsonb', nullable: true })
  sourceData?: object;

  @Index()
  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;
}
