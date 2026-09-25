import { z } from 'zod';

/** Bangladeshi mobile numbers in E.164: +8801XXXXXXXXX (operator digit 3-9). */
export const PHONE_PATTERN = /^\+8801[3-9]\d{8}$/;

/** Accepts `01800000003`, `+880 1800-000003` etc. and normalises to E.164. */
export function normalizePhone(input: string): string {
  const compact = input.replace(/[\s-]/g, '');
  if (/^01\d{9}$/.test(compact)) return `+880${compact.slice(1)}`;
  if (/^8801\d{9}$/.test(compact)) return `+${compact}`;
  return compact;
}

export const phoneSchema = z
  .string({ required_error: 'Phone number is required' })
  .trim()
  .transform(normalizePhone)
  .pipe(
    z.string().regex(PHONE_PATTERN, 'Enter a valid Bangladeshi mobile number, e.g. 01800000003'),
  );

export const RegisterBodySchema = z.object({
  fullName: z
    .string({ required_error: 'Name is required' })
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(80, 'Name must be at most 80 characters'),
  phone: phoneSchema,
  password: z
    .string({ required_error: 'Password is required' })
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters'),
});
export type RegisterInput = z.input<typeof RegisterBodySchema>;
export type RegisterBody = z.output<typeof RegisterBodySchema>;

export const LoginBodySchema = z.object({
  phone: phoneSchema,
  password: z
    .string({ required_error: 'Password is required' })
    .min(1, 'Password is required')
    .max(128),
});
export type LoginInput = z.input<typeof LoginBodySchema>;
export type LoginBody = z.output<typeof LoginBodySchema>;
