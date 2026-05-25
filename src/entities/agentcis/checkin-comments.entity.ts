import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('checkin_comments')
export class CheckinComments {
  @PrimaryColumn({ name: 'uuid', type: 'char', length: 36 })
  uuid: string;

  @Column({ name: '_id', type: 'varchar', length: 24, nullable: true })
  mongoId: string | null;

  @Column({ name: 'check_in_uuid', type: 'char', length: 36, nullable: true })
  checkInUuid: string | null;

  @Column({ name: 'comment', type: 'text', nullable: true })
  comment: string | null;

  @Column({ name: 'comment_by_email', type: 'varchar', length: 255, nullable: true })
  commentByEmail: string | null;

  @Column({ name: 'comment_by_name', type: 'varchar', length: 255, nullable: true })
  commentByName: string | null;

  @Column({ name: 'comment_time', type: 'datetime', nullable: true })
  commentTime: Date | null;
}
