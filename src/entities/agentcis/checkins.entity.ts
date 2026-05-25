import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('checkins')
export class Checkins {
  @PrimaryColumn({ name: 'uuid', type: 'char', length: 36 })
  uuid: string;

  @Column({ name: '_id', type: 'varchar', length: 24, nullable: true })
  mongoId: string | null;

  @Column({ name: 'old_id', type: 'varchar', length: 32, nullable: true })
  oldId: string | null;

  @Column({ name: 'office_name', type: 'varchar', length: 64, nullable: true })
  officeName: string | null;

  @Column({ name: 'visit_reason', type: 'text', nullable: true })
  visitReason: string | null;

  @Column({ name: 'visit_category', type: 'varchar', length: 64, nullable: true })
  visitCategory: string | null;

  @Column({ name: 'attendee_name', type: 'varchar', length: 500, nullable: true })
  attendeeName: string | null;

  @Column({ name: 'attendee_email', type: 'varchar', length: 255, nullable: true })
  attendeeEmail: string | null;

  @Column({ name: 'attendee_phone', type: 'varchar', length: 64, nullable: true })
  attendeePhone: string | null;

  @Column({ name: 'host_name', type: 'varchar', length: 255, nullable: true })
  hostName: string | null;

  @Column({ name: 'host_email', type: 'varchar', length: 255, nullable: true })
  hostEmail: string | null;

  @Column({ name: 'check_in_time', type: 'datetime', nullable: true })
  checkInTime: Date | null;

  @Column({ name: 'attended_time', type: 'datetime', nullable: true })
  attendedTime: Date | null;

  @Column({ name: 'completed_time', type: 'datetime', nullable: true })
  completedTime: Date | null;

  @Column({ name: 'comment', type: 'text', nullable: true })
  comment: string | null;

  @Column({ name: 'rating', type: 'varchar', length: 8, nullable: true })
  rating: string | null;
}
