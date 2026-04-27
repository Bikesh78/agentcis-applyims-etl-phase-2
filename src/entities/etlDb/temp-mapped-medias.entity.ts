import { Unique, Index, Column, Entity, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('temp_mapped_medias')
@Unique(['agentcisMediaId'])
export class TempMappedMedia {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Column({ type: 'int', name: 'agentcis_media_id' })
  agentcisMediaId: number;

  @Index()
  @Column({ type: 'varchar', length: 36, name: 'applyims_media_id' })
  applyimsMediaId: string;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'migration_id' })
  migrationId?: string;

  @Column({ type: 'boolean', default: false, name: 's3_copied' })
  s3Copied: boolean;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 's3_copy_error' })
  s3CopyError?: string;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'source_s3_key' })
  sourceS3Key?: string;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'destination_s3_key' })
  destinationS3Key?: string;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;
}
