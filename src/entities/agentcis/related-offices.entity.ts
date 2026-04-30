import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Referrers } from './referrers.entity.js';
import { Branches } from './branches.entity.js';

@Entity('related_offices')
export class RelatedOffices {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'officeable_id', type: 'int' })
  officeableId: number;

  @Column({ name: 'officeable_type', type: 'varchar', length: 255, nullable: true })
  officeableType: string | null;

  @Column({ name: 'office_id', type: 'int', unsigned: true })
  officeId: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Referrers, { nullable: true })
  @JoinColumn({ name: 'officeable_id' })
  referrer: Referrers;

  @ManyToOne(() => Branches)
  @JoinColumn({ name: 'office_id' })
  branch: Branches;
}
