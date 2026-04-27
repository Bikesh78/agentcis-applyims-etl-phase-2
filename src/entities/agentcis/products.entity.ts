import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Applications } from './applications.entity.js';

@Entity('products')
export class Products {
  @OneToMany(() => Applications, (application) => application.products)
  applications: Applications[];

  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'name', type: 'varchar' })
  name: string;

  @Column({ name: 'vendor_id', type: 'int' })
  vendorId: number;
}
