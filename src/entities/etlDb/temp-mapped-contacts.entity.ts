import { Unique, Index, Column, Entity, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('temp_mapped_contacts')
@Unique(['agentcisContactId'])
export class TempMappedContact {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Column({ type: 'int', name: 'agentcis_contact_id' })
  agentcisContactId: number;

  @Index()
  @Column({ type: 'varchar', length: 36, name: 'applyims_contact_id' })
  applyimsContactId: string;

  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true, name: 'migration_id' })
  migrationId?: string;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;
}
