import type { PoolStatus, RideRequestStatus } from '@tesla-pool/shared';

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export type PassengerAction = 'cancel';

export interface RideStatusPresentation {
  label: string;
  detail: string;
  tone: Tone;
  allowedActions: PassengerAction[];
  /** True once nothing more can happen to the ride: polling stops. */
  finished: boolean;
}

export interface RideStatusContext {
  driverName?: string;
  pickup?: string;
}

/**
 * Maps (request status, pool status) to what the passenger sees. Components never switch on raw
 * status strings; they ask this function.
 */
export function describeRide(
  status: RideRequestStatus,
  poolStatus: PoolStatus | null,
  context: RideStatusContext = {},
): RideStatusPresentation {
  const driver = context.driverName ?? 'Your driver';
  const pickup = context.pickup ?? 'the pick-up zone';

  switch (status) {
    case 'REQUESTED':
      return {
        label: 'Looking for a Tesla',
        detail: 'Waiting for a driver, or for a Tesla with room that is heading your way.',
        tone: 'info',
        allowedActions: ['cancel'],
        finished: false,
      };
    case 'MATCHED':
      if (poolStatus === 'DRIVER_ARRIVED') {
        return {
          label: `${driver} is at ${pickup}`,
          detail: 'Head to your Tesla now. It leaves as soon as the driver starts the trip.',
          tone: 'success',
          allowedActions: ['cancel'],
          finished: false,
        };
      }
      return {
        label: `${driver} is on the way`,
        detail: `Matched with a Tesla. Be ready at ${pickup}.`,
        tone: 'success',
        allowedActions: ['cancel'],
        finished: false,
      };
    case 'IN_PROGRESS':
      return {
        label: 'On your way',
        detail: 'Your fare is locked in and will not change.',
        tone: 'info',
        allowedActions: [],
        finished: false,
      };
    case 'COMPLETED':
      return {
        label: 'Trip complete',
        detail: 'Pay your driver in cash.',
        tone: 'success',
        allowedActions: [],
        finished: true,
      };
    case 'CANCELLED':
      return {
        label: 'Cancelled',
        detail: 'This ride was cancelled.',
        tone: 'neutral',
        allowedActions: [],
        finished: true,
      };
  }
}

export interface PoolStatusPresentation {
  label: string;
  tone: Tone;
  /** Which trip-level buttons the driver may press. */
  allowedActions: ('arrive' | 'start' | 'cancel')[];
  /** Whether individual riders can be dropped off. */
  canDropOff: boolean;
  finished: boolean;
}

export function describePool(status: PoolStatus): PoolStatusPresentation {
  switch (status) {
    case 'ACCEPTED':
      return {
        label: 'Heading to pick-up',
        tone: 'info',
        allowedActions: ['arrive', 'cancel'],
        canDropOff: false,
        finished: false,
      };
    case 'DRIVER_ARRIVED':
      return {
        label: 'Waiting for riders',
        tone: 'success',
        allowedActions: ['start', 'cancel'],
        canDropOff: false,
        finished: false,
      };
    case 'STARTED':
      return {
        label: 'Trip in progress',
        tone: 'info',
        allowedActions: [],
        canDropOff: true,
        finished: false,
      };
    case 'COMPLETED':
      return {
        label: 'Completed',
        tone: 'success',
        allowedActions: [],
        canDropOff: false,
        finished: true,
      };
    case 'CANCELLED':
      return {
        label: 'Cancelled',
        tone: 'neutral',
        allowedActions: [],
        canDropOff: false,
        finished: true,
      };
  }
}

export interface MemberPresentation {
  label: string;
  tone: Tone;
  canDropOff: boolean;
}

export function describeMember(
  status: RideRequestStatus,
  poolStatus: PoolStatus,
): MemberPresentation {
  switch (status) {
    case 'IN_PROGRESS':
      return { label: 'Riding', tone: 'info', canDropOff: describePool(poolStatus).canDropOff };
    case 'COMPLETED':
      return { label: 'Dropped off', tone: 'success', canDropOff: false };
    case 'MATCHED':
      return { label: 'Aboard soon', tone: 'neutral', canDropOff: false };
    case 'REQUESTED':
      return { label: 'Waiting', tone: 'neutral', canDropOff: false };
    case 'CANCELLED':
      return { label: 'Cancelled', tone: 'neutral', canDropOff: false };
  }
}

const TIMELINE_LABELS: Record<string, string> = {
  RIDE_REQUESTED: 'Ride requested',
  REQUEST_MATCHED: 'Matched with a Tesla',
  DRIVER_ARRIVED: 'Driver arrived at pick-up',
  REQUEST_STARTED: 'Trip started, fare locked in',
  REQUEST_COMPLETED: 'Dropped off',
  REQUEST_CANCELLED: 'Ride cancelled',
  REQUEST_REQUEUED: 'Driver cancelled, back in the queue',
};

export function timelineLabel(type: string): string {
  return TIMELINE_LABELS[type] ?? type;
}
