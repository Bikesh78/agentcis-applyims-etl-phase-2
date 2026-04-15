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
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Index()
  @Column({ type: 'varchar', length: 36, name: 'migration_id' })
  migrationId: string;

  @ManyToOne(() => MigrationJob, (m) => m.errors)
  @JoinColumn({ name: 'migration_id' })
  migration: MigrationJob;

  @Index()
  @Column({ type: 'varchar', length: 50, name: 'entity_type' })
  entityType: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'entity_id' })
  entityId?: string;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'error_code' })
  errorCode?: string;

  @Column({ type: 'text', nullable: true, name: 'error_message' })
  errorMessage?: string;

  @Column({ type: 'jsonb', nullable: true, name: 'error_details' })
  errorDetails?: object;

  @Column({ type: 'jsonb', nullable: true, name: 'source_data' })
  sourceData?: object;

  @Index()
  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;
}
