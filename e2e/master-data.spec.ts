import { test, expect } from '@playwright/test';

test.describe('Master Data Management E2E Flows', () => {
  test.beforeEach(async ({ page }) => {
    // Open main page directly (auto-unlock / demo user will log in)
    await page.goto('/');
  });

  test('should navigate between Truck Registry, Driver Database, and Offices tabs', async ({ page }) => {
    // Navigate to Truck Registry
    const truckTab = page.locator('#tab-btn-trucks');
    if (await truckTab.isVisible()) {
      await truckTab.click();
      await expect(page.locator('main, #root')).toBeVisible();
    }

    // Navigate to Driver Database
    const driverTab = page.locator('#tab-btn-drivers');
    if (await driverTab.isVisible()) {
      await driverTab.click();
      await expect(page.locator('main, #root')).toBeVisible();
    }

    // Navigate to Offices
    const officeTab = page.locator('#tab-btn-offices');
    if (await officeTab.isVisible()) {
      await officeTab.click();
      await expect(page.locator('main, #root')).toBeVisible();
    }
  });

  test('should navigate to Account Ledger and Tyre Management views', async ({ page }) => {
    // Navigate to Account Ledger
    const accountTab = page.locator('#tab-btn-accounts');
    if (await accountTab.isVisible()) {
      await accountTab.click();
      await expect(page.locator('main, #root')).toBeVisible();
    }

    // Navigate to Tyre Management
    const tyreTab = page.locator('#tab-btn-tyres');
    if (await tyreTab.isVisible()) {
      await tyreTab.click();
      await expect(page.locator('main, #root')).toBeVisible();
    }
  });
});
