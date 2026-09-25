import { z } from 'zod';
import { MAX_SEATS_PER_REQUEST, MIN_SEATS_PER_REQUEST } from '../constants';

export const zoneIdSchema = z.coerce
  .number({ invalid_type_error: 'Zone is required', required_error: 'Zone is required' })
  .int('Zone is invalid')
  .positive('Zone is invalid');

export const seatsSchema = z.coerce
  .number({ invalid_type_error: 'Seats must be a number', required_error: 'Seats is required' })
  .int('Seats must be a whole number')
  .min(MIN_SEATS_PER_REQUEST, `Book at least ${MIN_SEATS_PER_REQUEST} seat`)
  .max(
    MAX_SEATS_PER_REQUEST,
    `A Tesla seats ${MAX_SEATS_PER_REQUEST}, book at most ${MAX_SEATS_PER_REQUEST}`,
  );

/** Shared by the fare-estimate query and the create-ride body, and by the web form. */
export const TripSchema = z
  .object({
    pickupZoneId: zoneIdSchema,
    dropoffZoneId: zoneIdSchema,
    seats: seatsSchema,
  })
  .refine((trip) => trip.pickupZoneId !== trip.dropoffZoneId, {
    message: 'Pick-up and drop-off must be different zones',
    path: ['dropoffZoneId'],
  });
export type TripInput = z.input<typeof TripSchema>;
export type Trip = z.output<typeof TripSchema>;

export const FareEstimateQuerySchema = TripSchema;
export type FareEstimateQuery = Trip;
