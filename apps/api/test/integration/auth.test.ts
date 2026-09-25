import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Session, startHarness, type Harness } from './support/harness';

const NEW_PHONE = '+8801711000001';

function setCookieOf(response: request.Response): string {
  const header = response.headers['set-cookie'] as unknown as string[] | undefined;
  expect(header).toBeDefined();
  return header![0];
}

describe('auth routes', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await startHarness();
  });
  afterAll(async () => {
    await h.reset();
    await h.close();
  });
  beforeEach(async () => {
    await h.reset();
  });

  describe('POST /auth/register', () => {
    it('creates a passenger and signs them in with an httpOnly SameSite=Lax cookie', async () => {
      const response = await h
        .anonymous()
        .post('/auth/register', { fullName: 'Tania', phone: NEW_PHONE, password: 'sunrise-2026' });

      expect(response.status).toBe(201);
      expect(response.body.user).toMatchObject({
        fullName: 'Tania',
        phone: NEW_PHONE,
        role: 'PASSENGER',
      });
      expect(JSON.stringify(response.body)).not.toMatch(/password|hash/i);
      const cookie = setCookieOf(response);
      expect(cookie).toMatch(/^tesla_session=/);
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Lax/i);
      expect(cookie).not.toMatch(/Secure/i); // COOKIE_SECURE=false in tests
    });

    it('normalises local phone formats to E.164', async () => {
      const response = await h.anonymous().post('/auth/register', {
        fullName: 'Tania',
        phone: '017-1100 0002',
        password: 'sunrise-2026',
      });
      expect(response.status).toBe(201);
      expect(response.body.user.phone).toBe('+8801711000002');
    });

    it('never lets a caller choose their role', async () => {
      const response = await h.anonymous().post('/auth/register', {
        fullName: 'Sneaky',
        phone: '+8801711000003',
        password: 'sunrise-2026',
        role: 'DRIVER',
      });
      expect(response.status).toBe(201);
      expect(response.body.user.role).toBe('PASSENGER');
    });

    it('rejects a duplicate phone with 409 PHONE_ALREADY_REGISTERED', async () => {
      const body = { fullName: 'Tania', phone: NEW_PHONE, password: 'sunrise-2026' };
      expect((await h.anonymous().post('/auth/register', body)).status).toBe(201);
      const again = await h.anonymous().post('/auth/register', body);
      expect(again.status).toBe(409);
      expect(again.body.error.code).toBe('PHONE_ALREADY_REGISTERED');
    });

    it('rejects a phone that belongs to a seeded cast member', async () => {
      const response = await h.anonymous().post('/auth/register', {
        fullName: 'Impostor',
        phone: '+8801800000003',
        password: 'sunrise-2026',
      });
      expect(response.status).toBe(409);
    });

    it.each([
      ['short password', { fullName: 'Tania', phone: NEW_PHONE, password: 'short' }],
      ['bad phone', { fullName: 'Tania', phone: '12345', password: 'sunrise-2026' }],
      ['missing name', { phone: NEW_PHONE, password: 'sunrise-2026' }],
      ['empty body', {}],
    ])('rejects %s with 400 VALIDATION_FAILED', async (_label, body) => {
      const response = await h.anonymous().post('/auth/register', body);
      expect(response.status).toBe(400);
      expect(response.body.error).toMatchObject({ code: 'VALIDATION_FAILED' });
      expect(response.body.error.requestId).toEqual(expect.any(String));
    });
  });

  describe('POST /auth/login', () => {
    it('signs in a cast member with the demo password', async () => {
      const response = await h
        .anonymous()
        .post('/auth/login', { phone: '+8801800000003', password: 'pool-demo-123' });
      expect(response.status).toBe(200);
      expect(response.body.user).toMatchObject({ fullName: 'Nusrat', role: 'PASSENGER' });
      expect(setCookieOf(response)).toMatch(/HttpOnly/i);
    });

    it('signs in a driver with role DRIVER', async () => {
      const response = await h
        .anonymous()
        .post('/auth/login', { phone: '+8801800000001', password: 'pool-demo-123' });
      expect(response.status).toBe(200);
      expect(response.body.user).toMatchObject({ fullName: 'Jashim', role: 'DRIVER' });
    });

    it('answers a wrong password and an unknown phone identically', async () => {
      const wrongPassword = await h
        .anonymous()
        .post('/auth/login', { phone: '+8801800000003', password: 'not-the-password' });
      const unknownPhone = await h
        .anonymous()
        .post('/auth/login', { phone: '+8801999999999', password: 'not-the-password' });
      for (const response of [wrongPassword, unknownPhone]) {
        expect(response.status).toBe(401);
        expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
        expect(response.headers['set-cookie']).toBeUndefined();
      }
      expect(wrongPassword.body.error.message).toBe(unknownPhone.body.error.message);
    });
  });

  describe('GET /auth/me and POST /auth/logout', () => {
    it('returns the current user for a valid cookie', async () => {
      const nusrat = await h.as('nusrat');
      const response = await nusrat.get('/auth/me');
      expect(response.status).toBe(200);
      expect(response.body.user).toMatchObject({ fullName: 'Nusrat', role: 'PASSENGER' });
    });

    it('rejects a missing cookie with 401 UNAUTHENTICATED', async () => {
      const response = await h.anonymous().get('/auth/me');
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('rejects a tampered cookie', async () => {
      const nusrat = await h.as('nusrat');
      const forged = new Session(h.app, `${nusrat.cookie}x`);
      expect((await forged.get('/auth/me')).status).toBe(401);
    });

    it('logout clears the cookie', async () => {
      const nusrat = await h.as('nusrat');
      const response = await nusrat.post('/auth/logout');
      expect(response.status).toBe(204);
      expect(setCookieOf(response)).toMatch(/^tesla_session=;/);
      expect(setCookieOf(response)).toMatch(/Expires=Thu, 01 Jan 1970/);
    });

    it('logout requires a session', async () => {
      expect((await h.anonymous().post('/auth/logout')).status).toBe(401);
    });
  });

  describe('platform behaviour', () => {
    it('answers unknown routes with the standard error shape and a request id header', async () => {
      const response = await request(h.app)
        .get('/api/v1/nope')
        .set('x-request-id', 'trace-me-12345');
      expect(response.status).toBe(404);
      expect(response.headers['x-request-id']).toBe('trace-me-12345');
      expect(response.body).toEqual({
        error: { code: 'NOT_FOUND', message: 'Route not found.', requestId: 'trace-me-12345' },
      });
    });

    it('rejects malformed JSON with 400 VALIDATION_FAILED', async () => {
      const response = await request(h.app)
        .post('/api/v1/auth/login')
        .set('Content-Type', 'application/json')
        .send('{not json');
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('rejects oversized bodies with 413', async () => {
      const response = await request(h.app)
        .post('/api/v1/auth/login')
        .send({ phone: '+8801800000003', password: 'x'.repeat(20_000) });
      expect(response.status).toBe(413);
      expect(response.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    });

    it('forbids caching of API responses, including errors', async () => {
      const nusrat = await h.as('nusrat');
      expect((await nusrat.get('/auth/me')).headers['cache-control']).toBe('no-store');
      expect((await h.anonymous().get('/auth/me')).headers['cache-control']).toBe('no-store');
    });

    it('sends security headers', async () => {
      const response = await request(h.app).get('/health/live');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-powered-by']).toBeUndefined();
    });

    it('reports liveness and readiness', async () => {
      expect((await request(h.app).get('/health/live')).status).toBe(200);
      expect((await request(h.app).get('/health/ready')).status).toBe(200);
    });
  });
});

describe('auth rate limiting', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await startHarness({ AUTH_RATE_LIMIT_MAX: 3 });
  });
  afterAll(async () => {
    await h.close();
  });

  it('answers 429 RATE_LIMITED after too many attempts', async () => {
    const attempt = () =>
      h.anonymous().post('/auth/login', { phone: NEW_PHONE, password: 'whatever-1' });
    const statuses: number[] = [];
    for (let i = 0; i < 5; i += 1) statuses.push((await attempt()).status);
    expect(statuses).toEqual([401, 401, 401, 429, 429]);
    const limited = await attempt();
    expect(limited.body.error.code).toBe('RATE_LIMITED');
  });
});
