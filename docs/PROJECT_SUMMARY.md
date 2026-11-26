# GreenCart — Project Summary, Benefits, Scope & Delimitations

**Live Demo:** https://greencart-grts.onrender.com/

## 1. System Overview

**GreenCart** is a full-stack paperless retail and eco-store web application built with **React, TypeScript, Tailwind CSS, and Node.js + SQLite** (`node:sqlite`). It replaces printed thermal store receipts with **QR-backed digital receipts**, enforces **atomic inventory management**, and tracks **estimated paper and carbon savings** per transaction across two role-based portals:

- **Customer Portal (`src/client/components/CustomerShell.tsx`):** Browse, search, and filter the eco-product catalog, manage a persistent cart, complete checkout, view purchase history, inspect/print QR-backed digital receipts, track personal eco-impact, and update account profile/password settings.
- **Admin Operations Portal (`src/client/components/AdminShell.tsx`):**
  - **Dashboard (`AdminOverviewView.tsx`):** Store-wide KPIs (recorded transactions, sales volume, low-stock alerts, paper saved), searchable/filterable transaction ledger, and CSV export.
  - **POS Terminal (`PosView.tsx`):** Fast in-store walk-in checkout with keyboard shortcuts (`F2` search, `Enter` quick-add, `Esc` clear).
  - **Inventory & Catalog (`InventoryView.tsx`):** Product management, unique SKUs, image uploads, per-product reorder thresholds, stock adjustment audit logs, and soft-archiving (blocks new sales without breaking historical receipts).
  - **Digital Receipts & Eco-Impact (`ReceiptView.tsx`, `EcoImpactView.tsx`):** Local QR generation (`GC-...` opaque token encoding `?receipt=<token>`), token verification/lookup, and store-wide vs. personal eco-impact breakdown.
  - **7-Entity DB Inspector (`DbInspectorModal.tsx`):** Live read-only inspection of all 7 relational tables (`accounts`, `products`, `inventory`, `transactions`, `transaction_details`, `digital_receipts`, `eco_impact`).

---

## 2. Benefits to Users & Stakeholders

| Stakeholder | Key Benefits |
| :--- | :--- |
| **Customers (Shoppers)** | No lost or faded paper receipts; instant mobile access to itemized purchase history and printable QR receipts; visibility into personal paper and CO₂e savings; private receipts protected by account login and ownership checks. |
| **Cashiers / Store Staff** | Fast keyboard-driven POS terminal; real-time stock validation prevents overselling; automatic digital receipt generation without thermal printer hardware or paper jams. |
| **Store Owners / Admins** | Real-time low-stock and out-of-stock alerts; full inventory adjustment audit trail; searchable transaction history with safe CSV export; lower recurring cost on thermal paper rolls. |
| **Organization / Sustainability Goals** | Quantifies paperless adoption rate and estimated thermal paper / CO₂e reduction per order and store-wide, supporting sustainability reporting. |

---

## 3. Scope & Delimitations

### In Scope (Implemented)
1. **7-Entity Relational Persistence (SQLite):** `accounts`, `products`, `inventory`, `transactions`, `transaction_details`, `digital_receipts`, and `eco_impact` with transactional stock deduction and rollback on insufficient stock or duplicate checkout submission.
2. **Authentication & Security:** Salted `scrypt` password hashing, signed rolling session cookies, CSRF validation on state-changing requests, strict admin vs. customer role guards, admin self-registration blocking, and cross-customer receipt ownership enforcement.
3. **Server-Authoritative Pricing & Totals:** Client-supplied prices/totals are ignored; totals are computed server-side from persisted database records.
4. **Local QR Receipt Workflow:** Opaque `GC-...` tokens generated locally via `qrcode` (zero personal data encoded in the token), public unauthenticated QR scan viewing with redacted customer PII (`/api/public/receipts/token/:qrCode`), authenticated owner/admin lookup, and URL deep-linking (`?receipt=...`).
5. **Documented Eco-Impact Estimation Model:** Calculates `1.00` base thermal sheet + `0.25` sheets per distinct line item, and `3.50` g CO₂e avoided per sheet saved.
6. **Accessibility & Automated Verification:** WCAG 2.0 A/AA checked via `@axe-core/playwright`, unit/integration tests (`vitest`), and desktop/mobile E2E tests (`playwright`).

### Delimitations (Boundaries & Exclusions)
1. **No Real Payment Gateway:** Checkout records completed store/POS transactions in the database without integrating external payment processors (e.g., GCash, Stripe, cards).
2. **Project Estimates, Not Lab Measurements:** Paper and CO₂e figures are formula-based estimates derived from persisted receipt counts and line items, not physical lifecycle or emission audits. **Water saved** is excluded from the model.
3. **Single-Instance SQLite Storage:** Designed for single-server / local / demo deployment (`node:sqlite`). On free cloud tiers with ephemeral disks (e.g., Render Free), database state resets to seeded data on redeploy or restart; GitHub Pages runs in isolated browser `localStorage` demo mode.
4. **No External Notifications or Multi-Branch Sync:** Does not send SMS/email receipts (requires external API credentials such as Resend/Twilio), integrate native thermal printer drivers (uses browser print + keyboard-emulated USB HID barcode scanning via `F2` + `Enter`), or synchronize across multiple physical store branches (requires a shared cloud DB).
