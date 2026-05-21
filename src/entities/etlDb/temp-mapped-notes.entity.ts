import { Unique, Index, Column, Entity, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('temp_mapped_notes')
@Unique(['agentcisNoteId'])
export class TempMappedNote {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Column({ type: 'int', name: 'agentcis_note_id' })
  agentcisNoteId: number;

  @Index()
  @Column({ type: 'varchar', length: 36, name: 'applyims_note_id' })
  applyimsNoteId: string;

  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true, name: 'migration_id' })
  migrationId?: string;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;
}
