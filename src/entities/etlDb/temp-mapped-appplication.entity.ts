import { Unique, Index, Column, Entity, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('temp_mapped_applications')
@Unique(['agentcisApplicationId'])
export class TempMappedApplication {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Column({ type: 'int', name: 'agentcis_application_id' })
  agentcisApplicationId: number;

  @Index()
  @Column({ type: 'varchar', length: 36, name: 'applyims_application_id' })
  applyimsApplicationId: string;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'app_identifier' })
  appIdentifier?: string;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'migration_id' })
  migrationId?: string;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;
}
