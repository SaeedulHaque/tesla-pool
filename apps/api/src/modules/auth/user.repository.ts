import type { EntityManager } from '@mikro-orm/postgresql';
import { User } from './user.entity';

export interface UserRepository {
  findById(em: EntityManager, id: string): Promise<User | null>;
  findByPhone(em: EntityManager, phone: string): Promise<User | null>;
  add(em: EntityManager, user: User): void;
}

export class MikroOrmUserRepository implements UserRepository {
  findById(em: EntityManager, id: string): Promise<User | null> {
    return em.findOne(User, { id });
  }

  findByPhone(em: EntityManager, phone: string): Promise<User | null> {
    return em.findOne(User, { phone });
  }

  add(em: EntityManager, user: User): void {
    em.persist(user);
  }
}
