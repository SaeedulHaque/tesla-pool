import { z } from 'zod';
import { zoneIdSchema } from './fares';

export const AvailabilityBodySchema = z
  .object({
    online: z.boolean({ required_error: 'online is required', invalid_type_error: 'online must be true or false' }),
    zoneId: zoneIdSchema.optional(),
  })
  .refine((body) => !body.online || body.zoneId !== undefined, {
    message: 'Choose a zone to go online',
    path: ['zoneId'],
  });
export type AvailabilityInput = z.input<typeof AvailabilityBodySchema>;
export type AvailabilityBody = z.output<typeof AvailabilityBodySchema>;

export const RequestIdParamsSchema = z.object({ requestId: z.string().uuid('Invalid id') });
export type RequestIdParams = z.output<typeof RequestIdParamsSchema>;

export const PoolIdParamsSchema = z.object({ id: z.string().uuid('Invalid id') });
export type PoolIdParams = z.output<typeof PoolIdParamsSchema>;

export const PoolMemberParamsSchema = z.object({
  id: z.string().uuid('Invalid id'),
  requestId: z.string().uuid('Invalid id'),
});
export type PoolMemberParams = z.output<typeof PoolMemberParamsSchema>;
