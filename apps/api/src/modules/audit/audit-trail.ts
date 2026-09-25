import type { EntityManager } from '@mikro-orm/postgresql';
import type { AggregateRoot, DomainEvent } from '../../shared/domain/aggregate-root';
import { RideEvent } from './ride-event.entity';

/** Turns events recorded by aggregates into `ride_events` rows, inside the caller's transaction. */
export class AuditTrail {
  persist(em: EntityManager, ...aggregates: AggregateRoot[]): void {
    for (const aggregate of aggregates) {
      for (const event of aggregate.pullEvents()) em.persist(RideEvent.from(event));
    }
  }
}

export type { DomainEvent };
