import { Unique, Index, Column, Entity, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('temp_mapped_checkins')
@Unique(['agentcisCheckinUuid'])
export class TempMappedCheckin {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Column({ type: 'varchar', length: 36, name: 'agentcis_checkin_uuid' })
  agentcisCheckinUuid: string;

  @Index()
  @Column({ type: 'varchar', length: 36, name: 'applyims_office_visit_id' })
  applyimsOfficeVisitId: string;

  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true, name: 'migration_id' })
  migrationId?: string;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;
}
