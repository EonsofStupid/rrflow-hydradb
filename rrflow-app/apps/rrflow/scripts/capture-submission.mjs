import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

// Capture public project/practice views only. Personal email content is excluded.
const output = resolve('../../../submission/screenshots');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 }, reducedMotion: 'reduce' });
  await page.goto('http://127.0.0.1:3100/');
  await expect(page.getByText('HydraDB connected', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Connectome', exact: true }).click();
  const map = page.getByRole('region', { name: 'Living connectome' });
  await map.getByRole('button', { name: 'Shippin context', exact: true }).click();
  await expect(map.getByRole('button', { name: 'Refresh context', exact: true })).toBeEnabled();
  await map.getByRole('button', { name: /^Tool lesson\s*\d+/ }).click();
  for (const theme of ['dark', 'light']) {
    const toggle = page.getByRole('button', { name: `Switch to ${theme} mode`, exact: true });
    if (await toggle.count()) await toggle.click();
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: resolve(output, `07-connectome-${theme}.png`), fullPage: true, animations: 'disabled' });
  }
  await page.getByRole('button', { name: 'Databases', exact: true }).click();
  const databases = page.getByRole('region', { name: 'Manage brain databases' });
  await expect(databases.getByRole('heading', { name: 'Personal brain' })).toBeVisible();
  await expect(databases.getByRole('status')).toContainText('loaded');
  await page.screenshot({ path: resolve(output, '08-personal-and-work-databases.png'), fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Specialist brains', exact: true }).click();
  await page.getByRole('radio', { name: 'Senior dev practices', exact: true }).focus();
  await page.getByRole('radio', { name: 'Senior dev practices', exact: true }).press('Space');
  await page.getByLabel('Your question', { exact: true }).fill('Why does infisical secrets get fail in Git Bash?');
  const response = page.waitForResponse(item => item.url().endsWith('/api/mesh/recall') && item.request().method() === 'POST');
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  const result = await (await response).json();
  if (result.telemetry?.status !== 'accepted') throw new Error('Raindrop did not accept the demonstration event.');
  const feedback = page.waitForResponse(item => item.url().endsWith('/api/mesh/feedback') && item.request().method() === 'POST');
  await page.getByRole('button', { name: 'Yes', exact: true }).click();
  if (!(await (await feedback).json()).isRecorded) throw new Error('Raindrop did not accept the demonstration feedback.');
  await expect(page.locator('section[aria-labelledby="raindrop-heading"]')).toContainText('HTTP 204');
  await page.locator('#raindrop-heading').scrollIntoViewIfNeeded();
  await page.screenshot({ path: resolve(output, '09-raindrop-live-delivery.png'), animations: 'disabled' });
  console.log(JSON.stringify({ screenshots: 4, output, raindropEventId: result.eventId, hydraRequestId: result.requestId }));
} finally { await browser.close(); }
