import { Unique, Index, Column, Entity, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('temp_mapped_applications')
@Unique(['agentcisApplicationId'])
export class TempMappedApplication {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'int' })
  agentcisApplicationId: number;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  applyimsApplicationId: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  migrationId?: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;
}
