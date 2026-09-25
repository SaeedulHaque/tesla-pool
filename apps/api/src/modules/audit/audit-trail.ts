import type { EntityManager } from '@mikro-orm/postgresql';
import type { AggregateRoot, DomainEvent } from '../../shared/domain/aggregate-root';
import { RideEvent } from './ride-event.entity';

/** Turns events recorded by aggregates into `ride_events` rows, inside the caller's transaction. */
export class AuditTrail {
  persist(em: EntityManager, ...aggregates: AggregateRoot[]): void {
    const events = aggregates.flatMap((aggregate) => aggregate.pullEvents());
    // Insert in the order things happened, not aggregate by aggregate.
    events.sort((a, b) => a.sequence - b.sequence);
    for (const event of events) em.persist(RideEvent.from(event));
  }
}

export type { DomainEvent };
