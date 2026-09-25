import 'server-only';
import { cookies } from 'next/headers';
import type { UserDto } from '@tesla-pool/shared';

/**
 * Reads the signed-in user for Server Components by calling /auth/me with the incoming cookie.
 * Returns null only when signed out; an unreachable API throws, so the error page shows
 * instead of a misleading redirect to /login.
 */
export async function getSessionUser(): Promise<UserDto | null> {
  const cookie = (await cookies()).toString();
  if (!cookie) return null;

  const base = process.env.API_INTERNAL_URL;
  if (!base) throw new Error('API_INTERNAL_URL is not set');

  const response = await fetch(`${base.replace(/\/+$/, '')}/api/v1/auth/me`, {
    headers: { cookie },
    cache: 'no-store',
  });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error(`Session check failed: ${response.status}`);
  return ((await response.json()) as { user: UserDto }).user;
}
