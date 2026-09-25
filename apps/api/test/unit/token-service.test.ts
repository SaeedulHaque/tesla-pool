import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { TokenService } from '../../src/modules/auth/token-service';

const SECRET = 'unit-test-secret-that-is-at-least-32-chars';
const key = (secret: string) => new TextEncoder().encode(secret);

describe('TokenService', () => {
  const tokens = new TokenService(SECRET, 12);

  it('round-trips claims', async () => {
    const token = await tokens.issue({ userId: 'user-1', role: 'DRIVER' });
    expect(await tokens.verify(token)).toEqual({ userId: 'user-1', role: 'DRIVER' });
  });

  it('rejects garbage, tampering and other secrets', async () => {
    const token = await tokens.issue({ userId: 'user-1', role: 'PASSENGER' });
    expect(await tokens.verify('not-a-jwt')).toBeNull();
    expect(await tokens.verify(`${token}x`)).toBeNull();
    expect(
      await new TokenService('another-secret-that-is-at-least-32-chars', 12).verify(token),
    ).toBeNull();
  });

  it('rejects expired tokens', async () => {
    const expired = await new SignJWT({ role: 'PASSENGER' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user-1')
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(key(SECRET));
    expect(await tokens.verify(expired)).toBeNull();
  });

  it('rejects tokens with an unknown role claim', async () => {
    const odd = await new SignJWT({ role: 'ADMIN' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user-1')
      .setExpirationTime('1h')
      .sign(key(SECRET));
    expect(await tokens.verify(odd)).toBeNull();
  });

  it('expires after the configured lifetime', async () => {
    const token = await tokens.issue({ userId: 'user-1', role: 'PASSENGER' });
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    expect(payload.exp - payload.iat).toBe(12 * 3600);
    expect(tokens.maxAgeMs).toBe(12 * 3600 * 1000);
  });
});
