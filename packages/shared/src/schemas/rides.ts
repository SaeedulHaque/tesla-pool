import { z } from 'zod';
import { TripSchema } from './fares';

export const CreateRideRequestBodySchema = TripSchema;
export type CreateRideRequestInput = z.input<typeof CreateRideRequestBodySchema>;
export type CreateRideRequestBody = z.output<typeof CreateRideRequestBodySchema>;

export const RIDE_SCOPES = ['active', 'history'] as const;
export type RideScope = (typeof RIDE_SCOPES)[number];

export const ScopeQuerySchema = z.object({
  scope: z.enum(RIDE_SCOPES).default('active'),
});
export type ScopeQuery = z.output<typeof ScopeQuerySchema>;

export const IdParamsSchema = z.object({ id: z.string().uuid('Invalid id') });
export type IdParams = z.output<typeof IdParamsSchema>;
