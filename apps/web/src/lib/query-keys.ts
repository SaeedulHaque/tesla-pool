export const queryKeys = {
  zones: ['zones'] as const,
  activeRides: ['rides', 'active'] as const,
  rideHistory: ['rides', 'history'] as const,
  ride: (id: string) => ['rides', 'detail', id] as const,
  estimate: (pickup: number, dropoff: number, seats: number) =>
    ['estimate', pickup, dropoff, seats] as const,
  driverQueue: ['driver', 'queue'] as const,
  activePools: ['pools', 'active'] as const,
  poolHistory: ['pools', 'history'] as const,
};
