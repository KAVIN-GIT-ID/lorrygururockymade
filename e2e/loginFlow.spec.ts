import { test, expect } from '@playwright/test';

test.describe('FleetTrack Pro E2E - Login Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the main app url configured in playwright.config.ts
    await page.goto('/');
  });

  test('should load the page and show the login form header', async ({ page }) => {
    // Assert page has the branding header visible
    const title = page.locator('h2:has-text("FleetTrack Pro")');
    await expect(title).toBeVisible();

    const subtitle = page.locator('p:has-text("Enterprise Transport & Logistics Fleet Manager")');
    await expect(subtitle).toBeVisible();
  });

  test('should validate inputs and display error message on empty submit', async ({ page }) => {
    // Click submit button directly
    const loginBtn = page.locator('button[type="submit"]');
    await loginBtn.click();

    // Check if validation error is shown
    const errorBanner = page.locator('span:has-text("Please enter all required fields.")');
    await expect(errorBanner).toBeVisible();
  });

  test('should toggle between Log In and Create Account tabs', async ({ page }) => {
    // Initially we should be on Log In screen.
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toHaveText(/Log In to System/);

    // Switch to Create Account
    const createAccountTab = page.locator('button:has-text("Create Account")');
    await createAccountTab.click();

    // Submit button should update
    await expect(submitBtn).toHaveText(/Create Admin Account/);

    // Name field should now be visible
    const nameLabel = page.locator('label:has-text("Full Name")');
    await expect(nameLabel).toBeVisible();

    // Switch back to Log In
    const loginTab = page.locator('button:has-text("Log In")');
    await loginTab.click();

    // Submit button should revert
    await expect(submitBtn).toHaveText(/Log In to System/);
  });
});
