import { Unique, Column, Entity, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('temp_mapped_branches')
@Unique(['agentcisBranchId'])
export class TempMappedBranch {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Column({ type: 'int', name: 'agentcis_branch_id' })
  agentcisBranchId: number;

  @Column({ type: 'varchar', length: 36, name: 'branch_id' })
  branchId: string;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'migration_id' })
  migrationId?: string;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;
}
