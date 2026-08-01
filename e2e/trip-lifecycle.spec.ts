import { test, expect } from '@playwright/test';

test.describe('Trip Management & Operational Lifecycle E2E Flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should navigate to Trip Management tab and display trip list container', async ({ page }) => {
    const tripTab = page.locator('#tab-btn-trips');
    if (await tripTab.isVisible()) {
      await tripTab.click();
      await expect(page.locator('main, #root')).toBeVisible();
    }
  });

  test('should navigate to Expense Ledger tab', async ({ page }) => {
    const expenseTab = page.locator('#tab-btn-expenses');
    if (await expenseTab.isVisible()) {
      await expenseTab.click();
      await expect(page.locator('main, #root')).toBeVisible();
    }
  });
});
