import type { Express } from 'express';
import type { MikroORM } from '@mikro-orm/postgresql';
import pino from 'pino';
import request, { type Test } from 'supertest';
import { composeApp, type Overrides } from '../../../src/composition-root';
import type { Env } from '../../../src/config/env';
import { CAST } from '../../../src/database/seeders/reference-data';
import { connectTestOrm, resetState } from './database';
import { DEMO_PASSWORD, testEnv } from './test-env';

export type Person = keyof typeof CAST;

/** An HTTP client with a sign-in cookie, e.g. `as(nusrat).post('/ride-requests', {...})`. */
export class Session {
  constructor(
    private readonly app: Express,
    readonly cookie: string | null,
  ) {}

  private withCookie(test: Test): Test {
    return this.cookie ? test.set('Cookie', this.cookie) : test;
  }

  get(path: string): Test {
    return this.withCookie(request(this.app).get(`/api/v1${path}`));
  }

  post(path: string, body?: object): Test {
    return this.withCookie(
      request(this.app)
        .post(`/api/v1${path}`)
        .send(body ?? {}),
    );
  }

  put(path: string, body?: object): Test {
    return this.withCookie(
      request(this.app)
        .put(`/api/v1${path}`)
        .send(body ?? {}),
    );
  }
}

export class Harness {
  private readonly sessions = new Map<Person, Session>();

  constructor(
    readonly orm: MikroORM,
    readonly app: Express,
  ) {}

  /** Signs in as a cast member once, then reuses the cookie. */
  async as(person: Person): Promise<Session> {
    const cached = this.sessions.get(person);
    if (cached) return cached;
    const response = await request(this.app)
      .post('/api/v1/auth/login')
      .send({ phone: CAST[person].phone, password: DEMO_PASSWORD });
    if (response.status !== 200) {
      throw new Error(
        `Could not sign in as ${person}: ${response.status} ${JSON.stringify(response.body)}`,
      );
    }
    const cookie = (response.headers['set-cookie'] as unknown as string[] | undefined)?.[0]?.split(
      ';',
    )[0];
    if (!cookie) throw new Error(`No session cookie for ${person}`);
    const session = new Session(this.app, cookie);
    this.sessions.set(person, session);
    return session;
  }

  /** Registers a brand-new passenger (removed again by `reset`) and returns their session. */
  async registerPassenger(fullName: string, phone: string): Promise<Session> {
    const response = await request(this.app)
      .post('/api/v1/auth/register')
      .send({ fullName, phone, password: 'crowd-pass-2026' });
    if (response.status !== 201)
      throw new Error(`Could not register ${fullName}: ${response.status}`);
    const cookie = (response.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
    return new Session(this.app, cookie);
  }

  anonymous(): Session {
    return new Session(this.app, null);
  }

  reset(): Promise<void> {
    return resetState(this.orm);
  }

  async close(): Promise<void> {
    await this.orm.close();
  }
}

export async function startHarness(
  envOverrides: Partial<Env> = {},
  overrides: Overrides = {},
): Promise<Harness> {
  const orm = await connectTestOrm();
  const env = testEnv(envOverrides);
  const app = await composeApp(orm, env, pino({ level: 'silent' }), overrides);
  const harness = new Harness(orm, app);
  await harness.reset();
  return harness;
}
