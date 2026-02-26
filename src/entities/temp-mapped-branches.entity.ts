import { Unique, Column, Entity, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('temp_mapped_branches')
@Unique(['agentcisBranchId'])
export class TempMappedBranch {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'int' })
  agentcisBranchId: number;

  @Column({ type: 'varchar', length: 36 })
  branchId: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  migrationId?: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;
}
