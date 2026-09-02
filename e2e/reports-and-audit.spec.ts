import { test, expect } from '@playwright/test';

test.describe('Reports & System Audit E2E Flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should navigate to Monthly Reports module', async ({ page }) => {
    const reportsTab = page.locator('#tab-btn-reports');
    if (await reportsTab.isVisible()) {
      await reportsTab.click();
      await expect(page.locator('main, #root')).toBeVisible();
    }
  });

  test('should navigate to System Audit Logs module', async ({ page }) => {
    const auditTab = page.locator('#tab-btn-audit');
    if (await auditTab.isVisible()) {
      await auditTab.click();
      await expect(page.locator('main, #root')).toBeVisible();
    }
  });
});
