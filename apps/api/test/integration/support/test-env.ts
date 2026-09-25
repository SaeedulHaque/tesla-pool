import type { Env } from '../../../src/config/env';

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://tesla:change-me@localhost:5433/tesla_pool_test';

export const DEMO_PASSWORD = 'pool-demo-123';

export function testEnv(overrides: Partial<Env> = {}): Env {
  return {
    NODE_ENV: 'test',
    DATABASE_URL: TEST_DATABASE_URL,
    DATABASE_SSL: false,
    API_PORT: 0,
    JWT_SECRET: 'integration-test-secret-at-least-32-characters',
    JWT_TTL_HOURS: 12,
    COOKIE_SECURE: false,
    LOG_LEVEL: 'silent',
    SEED_DEMO_PASSWORD: DEMO_PASSWORD,
    AUTH_RATE_LIMIT_MAX: 1_000,
    AUTH_RATE_LIMIT_WINDOW_MINUTES: 15,
    TRUST_PROXY_HOPS: 1,
    ...overrides,
  };
}
