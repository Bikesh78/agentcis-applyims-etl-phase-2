import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';

@Entity('branches')
export class Branches {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'name', type: 'varchar', length: 255, nullable: true })
  name: string | null;

  @Column({ name: 'mobile', type: 'varchar', length: 255, nullable: true })
  mobile: string | null;

  @Column({ name: 'landline', type: 'varchar', length: 255, nullable: true })
  landline: string | null;

  @Column({ name: 'person_to_contact', type: 'varchar', length: 255, nullable: true })
  personToContact: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'street', type: 'varchar', length: 255, nullable: true })
  street: string | null;

  @Column({ name: 'city', type: 'varchar', length: 255, nullable: true })
  city: string | null;

  @Column({ name: 'zip_code', type: 'varchar', length: 255, nullable: true })
  zipCode: string | null;

  @Column({ name: 'country', type: 'varchar', length: 255, nullable: true })
  country: string | null;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;

  @Column({ name: 'added_by', type: 'int', unsigned: true, nullable: true })
  addedBy: number | null;

  @Column({ name: 'state', type: 'varchar', length: 255, nullable: true })
  state: string | null;

  @Column({ name: 'email', type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ name: 'business_registration_number', type: 'varchar', length: 255, nullable: true })
  businessRegistrationNumber: string | null;
}
