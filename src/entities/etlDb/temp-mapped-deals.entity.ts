import { Unique, Index, Column, Entity, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('temp_mapped_deals')
@Unique(['agentcisDealId'])
export class TempMappedDeal {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Index()
  @Column({ type: 'int', nullable: true, name: 'agentcis_deal_id' })
  agentcisDealId?: number;

  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true, name: 'applyims_deal_id' })
  applyimsDealId?: string;

  @Column({ type: 'varchar', length: 36, name: 'deal_id' })
  dealId: string;

  @Column({ type: 'varchar', length: 36, name: 'branch_id' })
  branchId: string;

  @Column({ type: 'int', nullable: true, name: 'service_id' })
  serviceId: number;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'deal_name' })
  dealName?: string;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'migration_id' })
  migrationId?: string;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;
}
