import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Applications } from './applications.entity.js';

@Entity('group_product_fees')
export class GroupProductFees {
  @PrimaryColumn({ name: 'id', type: 'int', unsigned: true })
  id: number;

  @ManyToOne(() => Applications, (application) => application.groupProductFees)
  @JoinColumn({ name: 'feeable_id', referencedColumnName: 'id' })
  application: Applications;

  @Column({ name: 'name', type: 'varchar', length: 255, nullable: true })
  name: string | null;

  @Column({ name: 'total', type: 'decimal', precision: 16, scale: 2, nullable: true })
  total: number | null;

  @Column({ name: 'discount', type: 'json', nullable: true })
  discount: any;

  @Column({ name: 'feeable_type', type: 'varchar', nullable: true })
  feeableType: string | null;
}
