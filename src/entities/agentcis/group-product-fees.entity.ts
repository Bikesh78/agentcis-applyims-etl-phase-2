import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Applications } from './applications.entity.js';

export type RevenueType = 0 | 1 | 2;

@Entity('group_product_fees')
export class GroupProductFees {
  @PrimaryColumn({ name: 'id', type: 'int', unsigned: true })
  id: number;

  @ManyToOne(() => Applications, (application) => application.groupProductFees)
  @JoinColumn({ name: 'feeable_id', referencedColumnName: 'id' })
  application: Applications;

  @Column({ name: 'name', type: 'varchar', length: 255, nullable: true })
  name: string | null;

  // @Column({ name: 'fee_term_id', type: 'int', unsigned: true })
  // feeTermId: number;

  @Column({ name: 'total', type: 'decimal', precision: 16, scale: 2, nullable: true })
  total: number | null;

  @Column({ name: 'discount', type: 'json', nullable: true })
  discount: any;

  @Column({ name: 'feeable_type', type: 'varchar', nullable: true })
  feeableType: string | null;

  // @Column({ name: 'feeable_id', type: 'bigint', unsigned: true })
  // feeableId: number;

  // @Column({ name: 'revenue_type', type: 'tinyint' })
  // revenueType: RevenueType;
  //
  // @Column({ name: 'created_at', type: 'timestamp', nullable: true })
  // createdAt: Date | null;
  //
  // @Column({ name: 'updated_at', type: 'timestamp', nullable: true })
  // updatedAt: Date | null;
  //
  // @Column({
  //   name: 'first_installment_amount',
  //   type: 'decimal',
  //   precision: 16,
  //   scale: 2,
  //   nullable: true,
  // })
  // firstInstallmentAmount: number | null;
}
