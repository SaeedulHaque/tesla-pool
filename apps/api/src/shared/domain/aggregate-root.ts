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
  /** Process-wide order in which events were recorded; persisted rows follow it. */
  readonly sequence: number;
}

export type NewDomainEvent = Omit<
  DomainEvent,
  'occurredAt' | 'sequence' | 'data' | 'rideRequestId' | 'poolId' | 'fromStatus' | 'toStatus'
> &
  Partial<Pick<DomainEvent, 'rideRequestId' | 'poolId' | 'fromStatus' | 'toStatus' | 'data'>>;

let nextSequence = 0;

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
      sequence: nextSequence++,
    });
  }

  pullEvents(): DomainEvent[] {
    const events = this.pendingEvents ?? [];
    this.pendingEvents = [];
    return events;
  }
}
