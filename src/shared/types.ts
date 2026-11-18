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

export interface EcoImpactSummary {
  scope: EcoScope;
  paperless_count: number;
  total_paper_saved: number;
  total_carbon_reduction: number;
  formula_note: string;
  ledger: EcoImpactLedgerRow[];
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
  if (distinctLineCount <= 0) {
    return { paper_saved: 0, carbon_reduction: 0 };
  }
  const paper_saved = Number((1.0 + distinctLineCount * 0.25).toFixed(2));
  const carbon_reduction = Number((paper_saved * 3.5).toFixed(2));
  return { paper_saved, carbon_reduction };
}
