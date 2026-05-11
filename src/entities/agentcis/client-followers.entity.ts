import { Entity, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Clients } from './clients.entity.js';

@Entity('client_followers')
export class ClientFollowers {
  @PrimaryColumn({ name: 'client_id', type: 'int' })
  clientId: number;

  @PrimaryColumn({ name: 'user_id', type: 'int' })
  userId: number;

  @ManyToOne(() => Clients, (client) => client.followers)
  @JoinColumn({ name: 'client_id' })
  client: Clients;
}
