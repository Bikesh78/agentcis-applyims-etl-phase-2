import { Unique, Column, Entity, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('temp_mapped_users')
@Unique(['agentcisUserId'])
export class TempMappedUser {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Column({ type: 'int', name: 'agentcis_user_id' })
  agentcisUserId: number;

  @Column({ type: 'varchar', length: 36, name: 'applyims_user_id' })
  applyimsUserId: string;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'migration_id' })
  migrationId?: string;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;
}
