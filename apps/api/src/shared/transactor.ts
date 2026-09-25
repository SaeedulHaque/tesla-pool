import type { EntityManager, MikroORM } from '@mikro-orm/postgresql';

/** Runs one use case inside exactly one database transaction. */
export interface Transactor {
  run<T>(work: (em: EntityManager) => Promise<T>): Promise<T>;
}

export class MikroOrmTransactor implements Transactor {
  constructor(private readonly orm: MikroORM) {}

  run<T>(work: (em: EntityManager) => Promise<T>): Promise<T> {
    // A fresh fork per use case: no shared identity map, so no stale reads across requests.
    return this.orm.em.fork().transactional(work);
  }
}
