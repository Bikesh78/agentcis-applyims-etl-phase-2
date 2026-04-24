import { Unique, Index, Column, Entity, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('temp_mapped_office_visits')
@Unique(['agentcisOfficeVisitId'])
export class TempMappedOfficeVisit {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Column({ type: 'int', name: 'agentcis_office_visit_id' })
  agentcisOfficeVisitId: number;

  @Index()
  @Column({ type: 'varchar', length: 36, name: 'applyims_office_visit_id' })
  applyimsOfficeVisitId: string;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'migration_id' })
  migrationId?: string;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;
}
