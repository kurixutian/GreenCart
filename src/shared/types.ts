export type AccountType = 'customer' | 'admin';

export type StockStatus = 'In Stock' | 'Low Stock' | 'Out of Stock';

export interface AccountRow {
  account_id: number;
  username: string;
  password_hash: string;
  account_type: AccountType;
  full_name: string;
}

export interface SafeUser {
  account_id: number;
  username: string;
  account_type: AccountType;
  full_name: string;
}

export const PRODUCT_CATEGORIES = [
  'Personal Care',
  'Bags & Totes',
  'Drinkware',
  'Kitchen & Home',
  'Stationery',
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export interface ProductRow {
  product_id: number;
  product_name: string;
  description: string;
  price: number;
  category: string;
  image_url: string | null;
  sku: string | null;
  is_archived: number;
}

export interface InventoryRow {
  inventory_id: number;
  product_id: number;
  quantity: number;
  reorder_level: number;
  stock_status: StockStatus;
}

export interface CatalogItem {
  product_id: number;
  product_name: string;
  description: string;
  price: number;
  category: string;
  image_url: string | null;
  sku: string | null;
  is_archived: number;
  inventory_id: number;
  quantity: number;
  reorder_level: number;
  stock_status: StockStatus;
}

export interface InventoryAdjustmentView {
  adjustment_id: number;
  product_id: number;
  product_name: string;
  sku: string | null;
  account_id: number;
  actor_name: string;
  delta: number;
  previous_qty: number;
  new_qty: number;
  reason: string;
  adjusted_at: string;
}

export interface TransactionRow {
  transaction_id: number;
  account_id: number;
  transaction_date: string;
  total_amount: number;
}

export interface TransactionDetailRow {
  detail_id: number;
  transaction_id: number;
  product_id: number;
  quantity: number;
  subtotal: number;
}

export interface DigitalReceiptRow {
  receipt_id: number;
  transaction_id: number;
  qr_code: string;
  receipt_date: string;
}

export interface EcoImpactRow {
  impact_id: number;
  transaction_id: number;
  paper_saved: number;
  carbon_reduction: number;
}

export interface SaleLineInput {
  product_id: number;
  quantity: number;
  // Optional untrusted fields that client tampering tests may attempt to send; ignored by server
  price?: number;
  subtotal?: number;
}

export interface SaleRequestPayload {
  account_id?: number;
  lineItems: SaleLineInput[];
  checkoutToken: string;
  // Untrusted total if sent by tampered browser; ignored by server
  total_amount?: number;
}

export interface ReceiptLineItemView {
  detail_id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface DigitalReceiptView {
  receipt_id: number;
  transaction_id: number;
  qr_code: string;
  receipt_date: string;
  transaction_date: string;
  total_amount: number;
  customer_account_id: number;
  customer_name: string;
  customer_username: string;
  paper_saved: number;
  carbon_reduction: number;
  items: ReceiptLineItemView[];
}

export interface PurchaseHistoryItem {
  transaction_id: number;
  transaction_date: string;
  total_amount: number;
  qr_code: string;
  receipt_date: string;
  item_count: number;
  total_units: number;
  paper_saved: number;
  carbon_reduction: number;
}

export type EcoScope = 'personal' | 'store';

export interface EcoImpactLedgerRow {
  transaction_id: number;
  transaction_date: string;
  qr_code: string;
  customer_name: string;
  total_amount: number;
  paper_saved: number;
  carbon_reduction: number;
}

export interface EcoImpactMetricSpec {
  key: 'paper_saved' | 'carbon_reduction' | 'paperless_count';
  label: string;
  unit: string;
  is_estimate: boolean;
  documented_in: string[];
}

export interface EcoImpactSpecification {
  base_receipt_sheets: number;
  sheets_per_distinct_line_item: number;
  grams_co2e_per_sheet: number;
  formula_note: string;
  metrics: EcoImpactMetricSpec[];
  pending_approval_note: string;
}

export const ECO_IMPACT_SPEC: EcoImpactSpecification = {
  base_receipt_sheets: 1.0,
  sheets_per_distinct_line_item: 0.25,
  grams_co2e_per_sheet: 3.5,
  formula_note:
    'Estimated impact: 1.00 base receipt sheet + 0.25 sheets per distinct line item; 3.50 g CO2e avoided per thermal sheet saved.',
  metrics: [
    {
      key: 'paper_saved',
      label: 'Paper Saved',
      unit: 'sheets',
      is_estimate: true,
      documented_in: ['Group4_Act.3 (1).md', 'Group4_Act.4 (1).md', 'Group4_Wireframe.md'],
    },
    {
      key: 'carbon_reduction',
      label: 'Carbon Reduction',
      unit: 'g CO₂e',
      is_estimate: true,
      documented_in: ['Group4_Act.3 (1).md', 'Group4_Act.4 (1).md', 'Group4_Wireframe.md'],
    },
    {
      key: 'paperless_count',
      label: 'Paperless Transactions',
      unit: 'receipts',
      is_estimate: false,
      documented_in: ['Group4_Wireframe.md', 'Group4_Act.4 (1).md'],
    },
  ],
  pending_approval_note:
    'Water saved is excluded from the implemented model until the group or adviser approves an explicit requirement, unit, source factor, and schema update.',
};

export interface EcoImpactSummary {
  scope: EcoScope;
  paperless_count: number;
  total_paper_saved: number;
  total_carbon_reduction: number;
  formula_note: string;
  specification?: EcoImpactSpecification;
  ledger: EcoImpactLedgerRow[];
}

export type AdminTransactionSort = 'newest' | 'oldest' | 'highest' | 'lowest';

export interface AdminTransactionFilter {
  search?: string;
  customerAccountId?: number;
  dateFrom?: string;
  dateTo?: string;
  sort?: AdminTransactionSort;
  limit?: number;
}

export interface AdminTransactionItem {
  transaction_id: number;
  account_id: number;
  customer_username: string;
  customer_name: string;
  transaction_date: string;
  total_amount: number;
  qr_code: string;
  receipt_date: string;
  item_count: number;
  total_units: number;
  paper_saved: number;
  carbon_reduction: number;
}

export interface DatabaseSnapshot {
  accounts: SafeUser[];
  products: ProductRow[];
  inventory: InventoryRow[];
  transactions: TransactionRow[];
  transaction_details: TransactionDetailRow[];
  digital_receipts: DigitalReceiptRow[];
  eco_impact: EcoImpactRow[];
}

export function calculateEcoMetrics(distinctLineCount: number): {
  paper_saved: number;
  carbon_reduction: number;
} {
  if (!Number.isInteger(distinctLineCount) || distinctLineCount <= 0) {
    return { paper_saved: 0, carbon_reduction: 0 };
  }
  const paper_saved = Number(
    (
      ECO_IMPACT_SPEC.base_receipt_sheets +
      distinctLineCount * ECO_IMPACT_SPEC.sheets_per_distinct_line_item
    ).toFixed(2)
  );
  const carbon_reduction = Number(
    (paper_saved * ECO_IMPACT_SPEC.grams_co2e_per_sheet).toFixed(2)
  );
  return { paper_saved, carbon_reduction };
}

export function deriveStockStatus(quantity: number, reorderLevel = 10): StockStatus {
  if (quantity <= 0) return 'Out of Stock';
  if (quantity <= reorderLevel) return 'Low Stock';
  return 'In Stock';
}

export function sanitizeCsvCell(val: string | number | null | undefined): string {
  const raw = val === null || val === undefined ? '' : String(val);
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}
