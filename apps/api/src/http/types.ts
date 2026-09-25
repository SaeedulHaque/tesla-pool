import type { UserRole } from '@tesla-pool/shared';

export interface AuthContext {
  userId: string;
  role: UserRole;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Correlation id; echoed as `x-request-id` and present on every log line. */
      requestId: string;
      auth?: AuthContext;
    }
  }
}

export {};
