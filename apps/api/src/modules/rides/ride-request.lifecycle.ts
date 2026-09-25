import type { RideRequestStatus } from '@tesla-pool/shared';
import { StateMachine } from '../../shared/domain/state-machine';

export const RideRequestLifecycle = new StateMachine<RideRequestStatus>('RideRequest', {
  REQUESTED: ['MATCHED', 'CANCELLED'],
  MATCHED: ['IN_PROGRESS', 'CANCELLED', 'REQUESTED'], // back to REQUESTED = re-queued after driver cancels
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
});
