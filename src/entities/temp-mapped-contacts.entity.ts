import { Unique, Index, Column, Entity, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('temp_mapped_contacts')
@Unique(['agentcisContactId'])
export class TempMappedContact {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'int' })
  agentcisContactId: number;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  applyimsContactId: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  dealId?: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  branchId?: string;

  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true })
  migrationId?: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;
}
