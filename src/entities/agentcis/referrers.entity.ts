import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
} from 'typeorm';
import { Applications } from './applications.entity.js';

@Entity('referrers')
export class Referrers {
  @OneToMany(() => Applications, (application) => application.referrers)
  applications: Applications[];

  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'name', type: 'varchar', length: 255, nullable: true })
  name: string | null;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'agent_type', type: 'json', nullable: true })
  agentType: number[];

  @Column({ name: 'email', type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ name: 'phone', type: 'varchar', length: 255, nullable: true })
  phone: string | null;

  @Column({ name: 'tax_number', type: 'varchar', length: 255, nullable: true })
  taxNumber: string | null;

  @Column({ name: 'country', type: 'varchar', length: 255, nullable: true })
  country: string | null;
}
