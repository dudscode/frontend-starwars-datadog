import { test, expect } from '@playwright/test';

test.describe('Characters screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/characters');
  });

  test('should display 10 character list items', async ({ page }) => {
    await expect(page.locator('mat-list-item')).toHaveCount(10, { timeout: 10000 });
  });

  test('should show pagination controls', async ({ page }) => {
    await expect(page.locator('mat-paginator')).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to the next page and load different characters', async ({ page }) => {
    const firstItems = await page.locator('mat-list-item').allTextContents();
    await page.locator('button[aria-label="Next page"]').click();
    await page.waitForTimeout(1500);
    const secondItems = await page.locator('mat-list-item').allTextContents();
    expect(firstItems).not.toEqual(secondItems);
  });

  test('default route should redirect to /characters', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/characters/);
  });
});
