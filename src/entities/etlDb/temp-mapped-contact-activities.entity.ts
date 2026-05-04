import { Unique, Index, Column, Entity, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('temp_mapped_contact_activities')
@Unique(['agentcisContactActivityId'])
export class TempMappedContactActivity {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Column({ type: 'int', name: 'agentcis_contact_activity_id' })
  agentcisContactActivityId: number;

  @Index()
  @Column({ type: 'uuid', name: 'applyims_contact_activity_id' })
  applyimsContactActivityId: string;

  @Column({ type: 'uuid', nullable: true, name: 'migration_id' })
  migrationId: string;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;
}
