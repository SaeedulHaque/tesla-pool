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

export type NewDomainEvent = Omit<
  DomainEvent,
  'occurredAt' | 'data' | 'rideRequestId' | 'poolId' | 'fromStatus' | 'toStatus'
> &
  Partial<Pick<DomainEvent, 'rideRequestId' | 'poolId' | 'fromStatus' | 'toStatus' | 'data'>>;

/**
 * Base for entities that record domain events; services persist them as `ride_events`.
 * The buffer is created lazily because the ORM hydrates entities without running constructors.
 */
export abstract class AggregateRoot {
  private pendingEvents?: DomainEvent[];

  protected record(event: NewDomainEvent): void {
    (this.pendingEvents ??= []).push({
      rideRequestId: null,
      poolId: null,
      fromStatus: null,
      toStatus: null,
      data: {},
      ...event,
      occurredAt: new Date(),
    });
  }

  pullEvents(): DomainEvent[] {
    const events = this.pendingEvents ?? [];
    this.pendingEvents = [];
    return events;
  }
}
