import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('GreenCart Browser E2E & Accessibility', () => {
  test('Customer flow: login, sort, product details, cart checkout, QR receipt, history, eco-impact & Axe', async ({
    page,
    isMobile,
  }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'GreenCart' })).toBeVisible();

    // Sign in via quick demo button
    await page.getByRole('button', { name: /Maria Santos/i }).click();
    await expect(page.getByText('BOTANICAL ECO MARKET')).toBeVisible();

    // Accessibility audit on Customer Catalog
    const catalogAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(catalogAxe.violations).toEqual([]);

    // Sort products by Price: Low to High
    await page.getByLabel('Sort products').selectOption('price-asc');

    // Open Product Details modal for Recycled Kraft Spiral Notebook
    await page.getByRole('button', { name: /View details for Recycled Kraft Spiral Notebook/i }).click();
    await expect(
      page.getByText(/Paperless checkout issues a digital QR receipt/i)
    ).toBeVisible();
    await page.getByRole('dialog').or(page.locator('.fixed.inset-0')).getByRole('button', { name: 'Add to Cart' }).click();

    // On mobile (<1024px) open bottom-sheet cart; on desktop cart sidebar is already visible
    if (isMobile || (page.viewportSize()?.width ?? 1280) < 1024) {
      await page.getByRole('button', { name: /Open shopping cart/i }).click();
    }

    await page.getByRole('button', { name: /Review & Confirm Order/i }).click();
    await page.getByRole('button', { name: /Confirm & Pay/i }).click();

    // Verify 128-bit QR Receipt rendered
    await expect(page.getByText(/GreenCart Paperless Receipt/i)).toBeVisible();
    await expect(page.locator('img[alt^="QR code for receipt GC-"]')).toBeVisible();
    const tokenText = await page.locator('article span.font-mono').first().innerText();
    expect(tokenText.trim()).toMatch(/^GC-[A-F0-9]{32}$/);

    // Check Purchase History
    const historyBtn = page
      .locator('nav:visible')
      .getByRole('button', { name: /History/i });
    await historyBtn.click();
    await expect(page.getByRole('heading', { name: 'Purchase History' })).toBeVisible();

    // Check Eco-Impact Dashboard
    const ecoBtn = page
      .locator('nav:visible')
      .getByRole('button', { name: /Eco-Impact/i });
    await ecoBtn.click();
    await expect(page.getByRole('heading', { name: 'Eco-Impact Dashboard' })).toBeVisible();
    await expect(page.getByText(/Cumulative Paper-Saving Milestone/i)).toBeVisible();
  });

  test('Admin flow: login, dashboard overview, POS sale, inventory filters & Axe', async ({
    page,
    isMobile,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Store Administrator/i }).click();

    // Verify AdminShell navigation and POS view
    await expect(page.getByRole('heading', { name: 'Admin Point of Sale' })).toBeVisible();

    // Verify deliberate Walk-In Customer default is selected dynamically
    const isNarrow = isMobile || (page.viewportSize()?.width ?? 1280) < 1024;
    if (isNarrow) {
      await page.getByRole('button', { name: /Open Register/i }).click();
    }
    const customerSelect = page.locator(
      isNarrow ? '#pos-customer-select-mobile' : '#pos-customer-select'
    );
    await expect(customerSelect).toBeVisible();
    const selectedLabel = await customerSelect.locator('option:checked').innerText();
    expect(selectedLabel).toContain('Walk-In Customer');
    if (isNarrow) {
      await page.getByRole('button', { name: /Close POS Register/i }).click();
    }

    // Navigate to Overview Dashboard
    const overviewBtn = page
      .locator('nav:visible')
      .getByRole('button', { name: /Dashboard|Home/i });
    await overviewBtn.click();
    await expect(page.getByRole('heading', { name: 'Store Operations Overview' })).toBeVisible();

    const overviewAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(overviewAxe.violations).toEqual([]);

    // Navigate back to POS and ring up a sale
    await page.getByRole('button', { name: /Open POS Terminal/i }).click();
    await page.getByRole('button', { name: /Recycled Kraft Spiral Notebook/i }).click();

    if (isNarrow) {
      await page.getByRole('button', { name: /Open Register/i }).click();
    }

    await page
      .getByRole('button', { name: /Complete Sale and Generate QR Receipt/i })
      .click();
    await expect(page.getByText(/GreenCart Paperless Receipt/i)).toBeVisible();

    // Navigate to Inventory and test stock filter
    const invBtn = page
      .locator('nav:visible')
      .getByRole('button', { name: /Inventory|Stock/i });
    await invBtn.click();
    await expect(
      page.getByRole('heading', { name: /Inventory & Catalog Management/i })
    ).toBeVisible();
    await page.getByRole('button', { name: 'Low Stock' }).click();
  });
});
