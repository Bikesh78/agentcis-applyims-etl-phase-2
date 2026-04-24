import { Unique, Index, Column, Entity, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('temp_mapped_deals')
@Unique(['dealId'])
@Unique('uniqueContactApplication', ['contactId', 'applicationId'])
export class TempMappedDeal {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Index()
  @Column({ type: 'varchar', length: 36, name: 'deal_id' })
  dealId: string;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'contact_id' })
  contactId?: string;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'branch_id' })
  branchId?: string;

  @Column({ type: 'text', nullable: true, name: 'application_id' })
  applicationId?: string;

  @Column({ type: 'timestamp', nullable: true, name: 'minimum_date' })
  minimumDate?: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'max_date' })
  maxDate?: Date;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'deal_name' })
  dealName?: string;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'user_id' })
  userId?: string;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'migration_id' })
  migrationId?: string;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;
}
