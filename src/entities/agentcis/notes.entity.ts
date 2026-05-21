import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('notes')
export class Notes {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'title', type: 'varchar', length: 255, nullable: true })
  title: string | null;

  @Column({ name: 'description', type: 'text' })
  description: string;

  @Column({ name: 'added_by', type: 'int', unsigned: true })
  addedBy: number;

  @Column({ name: 'notable_id', type: 'int' })
  notableId: number;

  @Column({ name: 'notable_type', type: 'varchar', length: 255, nullable: true })
  notableType: string | null;

  @Column({ name: 'namespace', type: 'varchar', length: 32, nullable: true })
  namespace: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp', nullable: true })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp', nullable: true })
  updatedAt: Date;
}
