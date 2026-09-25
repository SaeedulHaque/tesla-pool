import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startHarness, type Harness } from './support/harness';

const BANANI = 1;
const GULSHAN_1 = 2;
const MOHAKHALI = 4;

describe('GET /fare-estimates and /zones', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await startHarness();
  });
  afterAll(async () => {
    await h.reset();
    await h.close();
  });

  it("quotes Nusrat's Banani to Mohakhali ride: 90 taka solo, 72 taka pooled", async () => {
    const nusrat = await h.as('nusrat');
    const response = await nusrat.get(
      `/fare-estimates?pickupZoneId=${BANANI}&dropoffZoneId=${MOHAKHALI}&seats=1`,
    );
    expect(response.status).toBe(200);
    expect(response.body.estimate).toMatchObject({
      pickup: 'Banani',
      dropoff: 'Mohakhali',
      distanceM: 3_000,
      seats: 1,
      estimatedSoloPaisa: 9_000,
      estimatedPooledPaisa: 7_200,
      pricingVersion: 'v1',
      pooled: { basePaisa: 3_000, distancePaisa: 6_000, discountPaisa: 1_800, totalPaisa: 7_200 },
      solo: { basePaisa: 3_000, distancePaisa: 6_000, discountPaisa: 0, totalPaisa: 9_000 },
    });
  });

  it("quotes Rafiq's Banani to Gulshan 1 ride: 70 taka solo, 58 taka pooled", async () => {
    const rafiq = await h.as('rafiq');
    const response = await rafiq.get(
      `/fare-estimates?pickupZoneId=${BANANI}&dropoffZoneId=${GULSHAN_1}&seats=1`,
    );
    expect(response.body.estimate).toMatchObject({
      estimatedSoloPaisa: 7_000,
      estimatedPooledPaisa: 5_800,
    });
  });

  it('scales distance with seats', async () => {
    const shirin = await h.as('shirin');
    const response = await shirin.get(
      `/fare-estimates?pickupZoneId=${BANANI}&dropoffZoneId=${MOHAKHALI}&seats=2`,
    );
    expect(response.body.estimate).toMatchObject({
      estimatedSoloPaisa: 15_000,
      estimatedPooledPaisa: 3_000 + 12_000 - 3_600,
    });
  });

  it.each([
    ['same zone', `pickupZoneId=${BANANI}&dropoffZoneId=${BANANI}&seats=1`],
    ['too many seats', `pickupZoneId=${BANANI}&dropoffZoneId=${MOHAKHALI}&seats=4`],
    ['zero seats', `pickupZoneId=${BANANI}&dropoffZoneId=${MOHAKHALI}&seats=0`],
    ['missing dropoff', `pickupZoneId=${BANANI}&seats=1`],
    ['unknown zone', `pickupZoneId=${BANANI}&dropoffZoneId=999&seats=1`],
    ['non-numeric', 'pickupZoneId=a&dropoffZoneId=b&seats=c'],
  ])('rejects %s with 400 VALIDATION_FAILED', async (_label, query) => {
    const nusrat = await h.as('nusrat');
    const response = await nusrat.get(`/fare-estimates?${query}`);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('requires a session and the passenger role', async () => {
    const query = `/fare-estimates?pickupZoneId=${BANANI}&dropoffZoneId=${MOHAKHALI}&seats=1`;
    expect((await h.anonymous().get(query)).status).toBe(401);
    const jashim = await h.as('jashim');
    const forbidden = await jashim.get(query);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe('FORBIDDEN');
  });

  it('lists all nine zones for a signed-in user', async () => {
    const nusrat = await h.as('nusrat');
    const response = await nusrat.get('/zones');
    expect(response.status).toBe(200);
    expect(response.body.items.map((zone: { code: string }) => zone.code)).toEqual([
      'BANANI',
      'GULSHAN_1',
      'GULSHAN_2',
      'MOHAKHALI',
      'FARMGATE',
      'DHANMONDI',
      'MIRPUR_10',
      'UTTARA',
      'BASHUNDHARA',
    ]);
    expect(response.body.items[0]).toMatchObject({
      id: 1,
      name: 'Banani',
      latitude: expect.any(Number),
    });
    expect((await h.anonymous().get('/zones')).status).toBe(401);
  });
});
