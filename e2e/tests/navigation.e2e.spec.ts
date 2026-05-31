import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('should navigate from characters to films screen', async ({ page }) => {
    await page.goto('/characters');
    await page.getByRole('link', { name: 'Filmes' }).click();
    await expect(page).toHaveURL(/\/films/);
    await expect(page.locator('app-films')).toBeVisible();
  });

  test('should navigate from films to characters screen', async ({ page }) => {
    await page.goto('/films');
    await page.getByRole('link', { name: 'Personagens' }).click();
    await expect(page).toHaveURL(/\/characters/);
    await expect(page.locator('app-characters')).toBeVisible();
  });

  test('should highlight the active navigation link', async ({ page }) => {
    await page.goto('/characters');
    const activeLink = page.locator('a.active');
    await expect(activeLink).toContainText('Personagens');
  });

  test('should redirect unknown paths to /characters', async ({ page }) => {
    await page.goto('/unknown-path');
    await expect(page).toHaveURL(/\/characters/);
  });
});
