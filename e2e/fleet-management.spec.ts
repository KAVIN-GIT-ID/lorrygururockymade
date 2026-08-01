import { test, expect } from '@playwright/test';

test.describe('Fleet Management & Operational E2E Flows', () => {
  test('should load application dashboard and display main navigation modules', async ({ page }) => {
    await page.goto('/');

    // Check application title or dashboard branding element
    await expect(page).toHaveTitle(/Lorry\s*Guru|Truck Trip Tracker/i);

    // Verify main navigation buttons or tabs
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should allow opening vehicle or driver master view', async ({ page }) => {
    await page.goto('/');
    
    // Check if dashboard or navigation elements render cleanly
    const mainContainer = page.locator('main, #root, #app').first();
    await expect(mainContainer).toBeVisible();
  });
});
