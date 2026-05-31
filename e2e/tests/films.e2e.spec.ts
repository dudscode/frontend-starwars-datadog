import { test, expect } from '@playwright/test';

test.describe('Films screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/films');
  });

  test('should display film cards', async ({ page }) => {
    await expect(page.locator('mat-card').first()).toBeVisible({ timeout: 10000 });
  });

  test('should show episode number and title in each card', async ({ page }) => {
    await page.locator('mat-card').first().waitFor({ timeout: 10000 });
    const firstTitle = await page.locator('mat-card-title').first().textContent();
    expect(firstTitle).toContain('Episódio');
  });

  test('should not make a second network request on revisit', async ({ page }) => {
    await page.locator('mat-card').first().waitFor({ timeout: 10000 });

    const requests: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('swapi.dev/api/films')) {
        requests.push(req.url());
      }
    });

    await page.getByRole('link', { name: 'Personagens' }).click();
    await page.getByRole('link', { name: 'Filmes' }).click();
    await page.locator('mat-card').first().waitFor({ timeout: 5000 });

    expect(requests.length).toBe(0);
  });
});
