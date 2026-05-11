import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ClientFollowers } from './client-followers.entity.js';

export type AgentcisFirstPointOfContact = 'Phone' | 'Email' | 'In Person' | 'Webpage';

@Entity('clients')
export class Clients {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'first_name', type: 'varchar', length: 255 })
  firstName: string;

  @Column({ name: 'last_name', type: 'varchar', length: 255 })
  lastName: string;

  @Column({ name: 'email', type: 'varchar', unique: true })
  email: string;

  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @Column({ name: 'phone_number_country_code', type: 'varchar', length: 5, nullable: true })
  phoneNumberCountryCode: string | null;

  @Column({ name: 'phone', type: 'varchar', nullable: true })
  phone: string | null;

  @Column({ name: 'country_of_passport', type: 'varchar', nullable: true })
  countryOfPassport: string | null;

  @Column({ name: 'dob', type: 'date', nullable: true })
  dob: Date | null;

  @Column({ name: 'first_point_of_contact', type: 'varchar' })
  firstPointOfContact: AgentcisFirstPointOfContact;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'street', type: 'varchar', nullable: true })
  street: string | null;

  @Column({ name: 'city', type: 'varchar', nullable: true })
  city: string | null;

  @Column({ name: 'state', type: 'varchar', nullable: true })
  state: string | null;

  @Column({ name: 'zip_code', type: 'varchar', nullable: true })
  zipCode: string | null;

  @Column({ name: 'country', type: 'int', nullable: true })
  country: number | null;

  @Column({ name: 'assigned_to', type: 'int', nullable: true })
  assignedTo: number | null;

  @Column({ name: 'preferred_intake', type: 'date' })
  preferredIntake: Date;

  @Column({ name: 'archived_on', type: 'date' })
  archivedOn: Date;

  @Column({ name: 'archived_by', type: 'int', nullable: true })
  archivedBy: number | null;

  @Column({ name: 'visa_expiry_date', type: 'date' })
  visaExpiryDate: Date;

  @Column({ name: 'visa_type', type: 'varchar', nullable: true })
  visaType: string | null;

  @Column({ name: 'branch_id', type: 'int' })
  branchId: number;

  @Column({ name: 'passport_number', type: 'varchar', nullable: true })
  passportNumber: string | null;

  @OneToMany(() => ClientFollowers, (follower) => follower.client)
  followers: ClientFollowers[];
}
