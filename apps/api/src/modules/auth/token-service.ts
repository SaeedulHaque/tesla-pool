import { jwtVerify, SignJWT } from 'jose';
import type { UserRole } from '@tesla-pool/shared';
import { USER_ROLES } from '@tesla-pool/shared';

export interface SessionClaims {
  userId: string;
  role: UserRole;
}

export interface TokenVerifier {
  verify(token: string): Promise<SessionClaims | null>;
}

/** Stateless HS256 session tokens. Trade-off: they cannot be revoked before they expire. */
export class TokenService implements TokenVerifier {
  private readonly key: Uint8Array;

  constructor(
    secret: string,
    private readonly ttlHours: number,
  ) {
    this.key = new TextEncoder().encode(secret);
  }

  issue(claims: SessionClaims): Promise<string> {
    return new SignJWT({ role: claims.role })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(claims.userId)
      .setIssuedAt()
      .setExpirationTime(`${this.ttlHours}h`)
      .sign(this.key);
  }

  async verify(token: string): Promise<SessionClaims | null> {
    try {
      const { payload } = await jwtVerify(token, this.key, { algorithms: ['HS256'] });
      const role = payload.role;
      if (typeof payload.sub !== 'string' || !USER_ROLES.some((allowed) => allowed === role)) {
        return null;
      }
      return { userId: payload.sub, role: role as UserRole };
    } catch {
      return null; // expired, tampered, or malformed: all the same to the caller
    }
  }

  get maxAgeMs(): number {
    return this.ttlHours * 60 * 60 * 1000;
  }
}
