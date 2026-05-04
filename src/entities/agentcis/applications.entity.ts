import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Products } from './products.entity.js';
import { Referrers } from './referrers.entity.js';
import { GroupProductFees } from './group-product-fees.entity.js';
import { ApplicationAssignees } from './application-assignees.entity.js';
import { ApplicationStages } from './application-stages.entity.js';

export type AgentcisApplicationType = 'Open' | 'Complete' | 'Discontinue';

@Entity('applications')
export class Applications {
  @ManyToOne(() => Products, (product) => product.applications)
  @JoinColumn({ name: 'product_id' })
  products: Products;

  @ManyToOne(() => Referrers, (referrer) => referrer.applications)
  @JoinColumn({ name: 'referrer_id' })
  referrers: Referrers | null;

  @OneToMany(() => GroupProductFees, (groupProductFees) => groupProductFees.application)
  groupProductFees: GroupProductFees[];

  @OneToMany(() => ApplicationAssignees, (assignee) => assignee.application)
  applicationAssignees: ApplicationAssignees[];

  @OneToMany(() => ApplicationStages, (stage) => stage.application)
  applicationStages: ApplicationStages[];

  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'client_id', type: 'int' })
  clientId: number;

  @Column({ name: 'vendor_branch_id', type: 'int' })
  vendorBranchId: number;

  @Column({ name: 'service_id', type: 'int' })
  serviceId: number;

  @Column({ name: 'creator_id', type: 'int' })
  creatorId: number;

  @Column({ name: 'status', type: 'varchar' })
  status: AgentcisApplicationType;

  @Column({ name: 'current_stage', type: 'int' })
  currentStage: number;

  @Column({ name: 'applied_intake_date', type: 'date' })
  appliedIntakeDate: string | null;

  @Column({ name: 'start_date', type: 'timestamp' })
  startDate: Date;

  @Column({ name: 'end_date', type: 'timestamp' })
  endDate: Date;

  @Column({ name: 'added_by_branch_id', type: 'int' })
  addedByBranchId: number;

  @Column({ name: 'application_id', type: 'varchar' })
  applicationId: string | null;

  @Column({ name: 'super_agent_id', type: 'int' })
  superAgentId: number | null;

  // @Column({ name: 'referrer_id', type: 'int' })
  // referrerId: number;

  @Column({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;

  @Column({ name: 'discontinued_reason', type: 'varchar' })
  discontinuedReason: string | null;

  // @Column({ name: 'assignee_ids', type: 'varchar' })
  // assigneeIds: string | null;
}
