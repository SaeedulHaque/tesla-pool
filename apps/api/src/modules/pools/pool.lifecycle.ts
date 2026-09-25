import type { PoolStatus } from '@tesla-pool/shared';
import { StateMachine } from '../../shared/domain/state-machine';

export const PoolLifecycle = new StateMachine<PoolStatus>('Pool', {
  ACCEPTED: ['DRIVER_ARRIVED', 'CANCELLED'],
  DRIVER_ARRIVED: ['STARTED', 'CANCELLED'],
  STARTED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
});
