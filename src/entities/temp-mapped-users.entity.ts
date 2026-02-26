import { Unique, Column, Entity, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('temp_mapped_users')
@Unique(['agentcisUserId'])
export class TempMappedUser {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'int' })
  agentcisUserId: number;

  @Column({ type: 'varchar', length: 36 })
  applyimsUserId: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  migrationId?: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;
}
