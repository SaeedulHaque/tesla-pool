import type { Actor } from './actor';

export interface DomainEvent {
  readonly type: string;
  readonly rideRequestId: string | null;
  readonly poolId: string | null;
  readonly actor: Actor;
  readonly fromStatus: string | null;
  readonly toStatus: string | null;
  readonly data: Readonly<Record<string, unknown>>;
  readonly occurredAt: Date;
}

/** Base for entities that record domain events; services persist them as `ride_events`. */
export abstract class AggregateRoot {
  private pendingEvents: DomainEvent[] = [];

  protected record(
    event: Omit<DomainEvent, 'occurredAt' | 'data'> & { data?: DomainEvent['data'] },
  ): void {
    this.pendingEvents.push({ ...event, data: event.data ?? {}, occurredAt: new Date() });
  }

  pullEvents(): DomainEvent[] {
    const events = this.pendingEvents;
    this.pendingEvents = [];
    return events;
  }
}
