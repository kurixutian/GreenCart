import fs from 'node:fs';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const AUDIT_DIR = path.join(process.cwd(), 'docs', 'mobile-audit');

test.describe('GreenCart Browser E2E, Mobile P0 & Accessibility', () => {
  test.beforeAll(() => {
    fs.mkdirSync(AUDIT_DIR, { recursive: true });
  });

  test('Customer P0/P1 flow: 375px overflow check, sort URL, Esc modal, cart persistence, checkout, QR URL, history & Axe', async ({
    page,
  }) => {
    const isNarrow = (page.viewportSize()?.width ?? 1440) < 1024;
    const tag = isNarrow ? 'mobile-375' : 'desktop-1440';

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'GreenCart' })).toBeVisible();

    await page.getByRole('button', { name: /Maria Santos/i }).click();
    await expect(page.getByText('BOTANICAL ECO MARKET')).toBeVisible();

    // P0.1: Verify zero horizontal scroll at current viewport
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(hasOverflow).toBe(false);

    await page.screenshot({ path: path.join(AUDIT_DIR, `catalog-${tag}.png`) });

    // Accessibility check
    const catalogAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(catalogAxe.violations).toEqual([]);

    // P1.3: Sort Name Z-A and verify URL param persistence
    await page.getByLabel('Sort products').selectOption('name-desc');
    expect(page.url()).toContain('sort=name-desc');

    // Phase 1: Category filtering & product images
    await expect(page.locator('article img[alt="Bamboo Toothbrush 4-Pack"]')).toBeVisible();
    await page.getByRole('button', { name: 'Drinkware', exact: true }).click();
    expect(page.url()).toContain('category=Drinkware');
    await expect(page.getByText('Insulated Stainless Tumbler 500ml')).toBeVisible();
    await page.getByRole('button', { name: 'All Categories', exact: true }).click();

    // P1.3: Open Product Detail modal and close with Escape
    await page
      .getByRole('button', { name: /View details for Recycled Kraft Spiral Notebook/i })
      .click();
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    await expect(modal.locator('img[alt="Recycled Kraft Spiral Notebook"]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();

    // Add item from modal and verify toast + localStorage cart persistence across reload
    await page
      .getByRole('button', { name: /View details for Recycled Kraft Spiral Notebook/i })
      .click();
    await modal.getByRole('button', { name: 'Add to Cart' }).click();
    await expect(page.getByRole('button', { name: 'View Cart' })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('button', { name: /Open shopping cart/i })).toContainText('1');

    if (isNarrow) {
      await page.getByRole('button', { name: /Open shopping cart/i }).click();
    }

    await page.getByRole('button', { name: /Review & Confirm Order/i }).click();
    await page.getByRole('button', { name: /Confirm & Pay/i }).click();

    // P1.1 & P1.5: Confirmation banner, token-only URL, and 128-bit QR receipt
    await expect(page.getByText(/Order confirmed — your paperless digital receipt/i)).toBeVisible();
    await expect(page.locator('img[alt^="QR code for receipt GC-"]')).toBeVisible();
    expect(page.url()).toMatch(/receipt=GC-[A-F0-9]{32}/);

    await page.screenshot({ path: path.join(AUDIT_DIR, `receipt-${tag}.png`) });

    // Axe on Receipt View + invalid QR token lookup safety check
    const receiptAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(receiptAxe.violations).toEqual([]);

    const savedUrl = page.url();
    await page
      .getByPlaceholder(/Enter QR receipt token/i)
      .fill('GC-00000000000000000000000000000000');
    await page.getByRole('button', { name: /Verify Receipt Token/i }).click();
    await expect(page.getByText(/No digital receipt matched that QR token/i)).toBeVisible();
    expect(page.url()).toBe(savedUrl);

    // Purchase History & Eco-Impact + Axe checks
    await page.locator('nav:visible').getByRole('button', { name: /History/i }).click();
    await expect(page.getByRole('heading', { name: 'Purchase History' })).toBeVisible();
    const historyAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(historyAxe.violations).toEqual([]);

    await page.locator('nav:visible').getByRole('button', { name: /Eco-Impact/i }).click();
    await expect(page.getByRole('heading', { name: 'Eco-Impact Dashboard' })).toBeVisible();
    await expect(page.getByText(/Cumulative Paper-Saving Milestone/i)).toBeVisible();
    const ecoAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(ecoAxe.violations).toEqual([]);
  });

  test('Admin P0/P1 flow: dashboard, POS F2/Enter shortcut sale, low-stock priority, inline edit & Axe', async ({
    page,
  }) => {
    const isNarrow = (page.viewportSize()?.width ?? 1440) < 1024;
    const tag = isNarrow ? 'mobile-375' : 'desktop-1440';

    await page.goto('/');
    await page.getByRole('button', { name: /Store Administrator/i }).click();
    await expect(page.getByRole('heading', { name: 'Admin Point of Sale' })).toBeVisible();

    const posOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(posOverflow).toBe(false);
    await page.screenshot({ path: path.join(AUDIT_DIR, `pos-${tag}.png`) });

    const posAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(posAxe.violations).toEqual([]);

    // Verify dynamic Walk-In Customer default & empty POS register submit button is disabled
    if (isNarrow) {
      await page.getByRole('button', { name: /Open Register/i }).click();
    }
    await expect(
      page.getByRole('button', { name: /Complete Sale and Generate QR Receipt/i })
    ).toBeDisabled();
    const customerSelect = page.locator(
      isNarrow ? '#pos-customer-select-mobile' : '#pos-customer-select'
    );
    await expect(customerSelect).toBeVisible();
    expect(await customerSelect.locator('option:checked').innerText()).toContain('Walk-In Customer');
    if (isNarrow) {
      await page.getByRole('button', { name: /Close POS Register/i }).click();
    }

    // Dashboard overview + Axe check
    await page.locator('nav:visible').getByRole('button', { name: /Dashboard|Home/i }).click();
    await expect(page.getByRole('heading', { name: 'Store Operations Overview' })).toBeVisible();

    const overviewAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(overviewAxe.violations).toEqual([]);

    // P1.4: POS keyboard F2 search + Enter add + Complete sale
    await page.getByRole('button', { name: /Open POS Terminal/i }).click();
    await page.keyboard.press('F2');
    await page.locator('#pos-search-input').fill('Recycled Kraft');
    await page.locator('#pos-search-input').press('Enter');

    if (isNarrow) {
      await page.getByRole('button', { name: /Open Register/i }).click();
    }
    await page.getByRole('button', { name: /Complete Sale and Generate QR Receipt/i }).click();
    await expect(page.getByText(/Order confirmed — your paperless digital receipt/i)).toBeVisible();

    // P1.4: Inventory low-stock top ordering & mobile cards / desktop inline edit
    await page.locator('nav:visible').getByRole('button', { name: /Inventory|Stock/i }).click();
    await expect(page.getByRole('heading', { name: /Inventory & Catalog Management/i })).toBeVisible();

    const invOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(invOverflow).toBe(false);
    await page.screenshot({ path: path.join(AUDIT_DIR, `inventory-${tag}.png`) });

    const inventoryAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(inventoryAxe.violations).toEqual([]);

    if (!isNarrow) {
      // First row is Out of Stock (Natural Loofah Dish Scrubbers)
      const firstRowText = await page.locator('tbody tr').first().innerText();
      expect(firstRowText).toContain('Out of Stock');
    }

    // Phase 1: Verify Admin Add Product modal includes Category & Image Upload
    await page.getByRole('button', { name: /Add New Product/i }).click();
    await expect(page.locator('#product-category-select')).toBeVisible();
    await expect(page.locator('#product-image-upload')).toBeVisible();
    await page.getByRole('button', { name: /Close product form/i }).click();
  });
});
