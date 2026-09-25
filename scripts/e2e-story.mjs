// Drives the full Nusrat, Rafiq and Shirin story in a real browser against a running stack
// (`docker compose up -d --build`) and saves the screenshots used in the README.
// Needs Playwright: `npm i --no-save playwright && npx playwright install chromium`.
// Run on a freshly seeded database (`docker compose down -v` first): it books real rides.
import { chromium } from 'playwright';
const OUT = process.env.SCREENSHOT_DIR ?? 'docs/screenshots';
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const browser = await chromium.launch(
  process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME, args: ['--no-sandbox'] } : {},
);

async function login(phone) {
  const ctx = await browser.newContext({ viewport: { width: 900, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', phone, e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') console.log('CONSOLE', phone, m.text());
  });
  await page.goto(`${BASE}/login`);
  await page.getByLabel('Phone number').fill(phone);
  await page.getByLabel('Password').fill('pool-demo-123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/(ride|driver)/);
  return page;
}
const shot = (page, name, opts = {}) => page.screenshot({ path: `${OUT}/${name}.png`, ...opts });

const jashim = await login('01800000001');
await jashim.getByLabel('Go online in').selectOption({ label: 'Banani' });
await jashim.getByRole('button', { name: 'Go online' }).click();
await jashim.getByText('Online in Banani').waitFor();
await shot(jashim, '01-driver-online-empty-queue');

const nusrat = await login('01800000003');
await nusrat.getByLabel('Pick-up zone').selectOption({ label: 'Banani' });
await nusrat.getByLabel('Drop-off zone').selectOption({ label: 'Mohakhali' });
await nusrat.getByText('If you share').waitFor();
await shot(nusrat, '02-passenger-request-with-fare-estimate');
await nusrat.getByRole('button', { name: 'Request a Tesla' }).click();
await nusrat.getByText('Looking for a Tesla').first().waitFor();
await shot(nusrat, '03-passenger-looking-for-tesla');

await jashim.getByText('Nusrat').first().waitFor({ timeout: 15000 });
await shot(jashim, '04-driver-queue-with-request');
await jashim.getByRole('button', { name: 'Accept' }).click();
await jashim.getByText('1/3').waitFor();
await shot(jashim, '05-driver-pool-1-of-3');

const rafiq = await login('01800000004');
await rafiq.getByLabel('Pick-up zone').selectOption({ label: 'Banani' });
await rafiq.getByLabel('Drop-off zone').selectOption({ label: 'Gulshan 1' });
await rafiq.getByText('If you share').waitFor();
await rafiq.getByRole('button', { name: 'Request a Tesla' }).click();
await rafiq.getByText('Jashim is on the way').waitFor();

const shirin = await login('01800000005');
await shirin.getByLabel('Pick-up zone').selectOption({ label: 'Banani' });
await shirin.getByLabel('Drop-off zone').selectOption({ label: 'Mohakhali' });
await shirin.getByText('If you share').waitFor();
await shirin.getByRole('button', { name: 'Request a Tesla' }).click();
await shirin.getByText('Jashim is on the way').waitFor();
await shot(shirin, '06-passenger-matched-last-seat');

await jashim.getByText('3/3').waitFor({ timeout: 15000 });
await shot(jashim, '07-driver-pool-3-of-3');
await jashim.getByRole('button', { name: /I've arrived/ }).click();
await nusrat.getByText('Jashim is at Banani').waitFor({ timeout: 15000 });
await shot(nusrat, '08-passenger-driver-arrived');
await jashim.getByRole('button', { name: /Start trip/ }).click();
await nusrat.getByText('On your way').waitFor({ timeout: 15000 });
await nusrat.getByText('৳72.00').first().waitFor();
await shot(nusrat, '09-passenger-fare-locked', { fullPage: true });
await rafiq.getByText('On your way').waitFor({ timeout: 15000 });
await rafiq.getByText('৳58.00').first().waitFor();
await shot(rafiq, '10-passenger-rafiq-own-fare', { fullPage: true });
await shot(jashim, '11-driver-trip-started', { fullPage: true });

for (let i = 0; i < 3; i++)
  await jashim
    .getByRole('button', { name: 'Drop off' })
    .first()
    .click()
    .then(() => jashim.waitForTimeout(700));
await jashim
  .getByText('Completed')
  .first()
  .waitFor({ timeout: 10000 })
  .catch(() => {});
await nusrat.getByText('Trip complete').waitFor({ timeout: 15000 });
await shot(nusrat, '12-passenger-trip-complete', { fullPage: true });
await jashim.goto(`${BASE}/driver/trips`);
await jashim.getByText('collected').first().waitFor();
await shot(jashim, '13-driver-trip-history', { fullPage: true });
await nusrat.goto(`${BASE}/rides`);
await nusrat.getByText('Trip complete').first().waitFor();
await shot(nusrat, '14-passenger-history', { fullPage: true });
console.log('STORY OK');
await browser.close();
