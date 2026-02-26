import { Unique, Index, Column, Entity, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('temp_mapped_deals')
@Unique(['branchId', 'serviceId'])
export class TempMappedDeal {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  dealId: string;

  @Column({ type: 'varchar', length: 36 })
  branchId: string;

  @Column({ type: 'int', nullable: true })
  serviceId: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  dealName?: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  migrationId?: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;
}
