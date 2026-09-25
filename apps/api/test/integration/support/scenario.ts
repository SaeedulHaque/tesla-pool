import { expect } from 'vitest';
import type { Harness, Person } from './harness';

export const ZONE = {
  BANANI: 1,
  GULSHAN_1: 2,
  GULSHAN_2: 3,
  MOHAKHALI: 4,
  FARMGATE: 5,
  DHANMONDI: 6,
  MIRPUR_10: 7,
  UTTARA: 8,
  BASHUNDHARA: 9,
} as const;

export interface TripInput {
  pickupZoneId: number;
  dropoffZoneId: number;
  seats: number;
}

/** The story's three requests, Banani to somewhere. */
export const TRIP = {
  nusrat: { pickupZoneId: ZONE.BANANI, dropoffZoneId: ZONE.MOHAKHALI, seats: 1 },
  rafiq: { pickupZoneId: ZONE.BANANI, dropoffZoneId: ZONE.GULSHAN_1, seats: 1 },
  shirin: { pickupZoneId: ZONE.BANANI, dropoffZoneId: ZONE.MOHAKHALI, seats: 1 },
} as const satisfies Record<string, TripInput>;

/** Readable set-up and actions for the cast: `given.bulletAtBanani({ seatsTaken: 2 })`. */
export class Scenario {
  constructor(private readonly h: Harness) {}

  async goOnline(driver: Person, zoneId: number): Promise<void> {
    const session = await this.h.as(driver);
    const response = await session.put('/driver/availability', { online: true, zoneId });
    expect(response.status, JSON.stringify(response.body)).toBe(200);
  }

  async requestRide(person: Person, trip: TripInput): Promise<{ id: string; status: string }> {
    const session = await this.h.as(person);
    const response = await session.post('/ride-requests', trip);
    expect(response.status, JSON.stringify(response.body)).toBe(201);
    return response.body.ride;
  }

  async accept(driver: Person, requestId: string) {
    const session = await this.h.as(driver);
    const response = await session.post(`/driver/queue/${requestId}/accept`);
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    return response.body.pool as { id: string; seatsOccupied: number; status: string };
  }

  /**
   * Jashim is online at Banani. With `seatsTaken > 0`, Rafiq (Banani to Gulshan 1) holds that many
   * seats in Bullet's active pool, so Bullet is at `seatsTaken`/3.
   */
  async bulletAtBanani(
    options: { seatsTaken?: 0 | 1 | 2 | 3 } = {},
  ): Promise<{ poolId: string | null; rafiqRideId: string | null }> {
    await this.goOnline('jashim', ZONE.BANANI);
    const seatsTaken = options.seatsTaken ?? 0;
    if (seatsTaken === 0) return { poolId: null, rafiqRideId: null };
    const rafiqRide = await this.requestRide('rafiq', { ...TRIP.rafiq, seats: seatsTaken });
    const pool = await this.accept('jashim', rafiqRide.id);
    expect(pool.seatsOccupied).toBe(seatsTaken);
    return { poolId: pool.id, rafiqRideId: rafiqRide.id };
  }

  async seatsOccupied(poolId: string): Promise<number> {
    const [row] = await this.h.orm.em
      .getConnection()
      .execute<{ seats_occupied: number }[]>('select seats_occupied from pools where id = ?', [
        poolId,
      ]);
    return row.seats_occupied;
  }
}
