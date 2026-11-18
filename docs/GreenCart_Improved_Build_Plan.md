# GreenCart — Improved Full-Stack TypeScript & Tailwind CSS Build Plan

> **Project:** GreenCart — An Eco-Friendly Shopping Application with Paperless Receipts  
> **Purpose of this document:** A controlled, phase-by-phase implementation plan engineered for TypeScript, React, Tailwind CSS, and Node.js (`node:sqlite`), accelerated with curated engineering skills, Vite plugins, and MCP tooling.  
> **Primary implementation stack:** TypeScript 5, React 19, Vite, Tailwind CSS v4 (`@tailwindcss/vite`), Node.js 24 (`node:sqlite` `DatabaseSync`), `qrcode`, and Vitest.

---

## 1. Project Definition and Source-of-Truth Rules

### 1.1 Project objective

GreenCart is a web-based shopping and point-of-sale application that connects customer accounts, product records, inventory, completed purchases, digital receipts, and estimated environmental impact through a relational database.

The application has two main user areas:

- **Customer portal:** registration/login, product catalog, search, cart, digital receipt viewing, purchase history, and an Eco-Impact dashboard.
- **Admin area:** login, POS sales processing, and inventory management.

The POS layout takes clean split-pane interaction inspiration from the CheoreoBiz reference, while the customer-facing storefront uses the fresh Ogani botanical palette (`#7fad39` leaf green) rebuilt cleanly in React + Tailwind CSS.

### 1.2 Source hierarchy

| Source | What it establishes | How it must be used |
|---|---|---|
| `Group4_Act.3 (1).md` | GreenCart's three-tier architecture, seven database entities, and core data flow | Primary source for system architecture and database scope |
| `Group4_Act.4 (1).md` | Seven-entity ERD, relationships, and cardinalities | Primary source for entity relationships and database constraints |
| `Group4_Wireframe.md` | Required screens and expected user interactions | Primary source for the visible application scope |
| `Group4_Act.1.md` | PhilHealth eClaims case study (centralization, paper reduction, gradual adoption) | Project rationale and lessons only; not a GreenCart feature specification |
| `greencart_interactive_prototype.html` | Initial Tailwind visual design, seeded products/accounts, and documented Eco-Impact baseline formula | Visual and baseline data reference |

### 1.3 Evidence labels

Every implementation decision is classified as:
- **Documented requirement:** directly supported by the GreenCart activities or wireframe.
- **Implementation detail:** a technical choice needed to implement a documented requirement without changing project scope (e.g., TypeScript types, Vite API middleware, `node:sqlite`, scrypt password hashing).
- **Proposed enhancement:** a feature or database change outside the submitted 7-entity ERD (requires explicit approval before altering schema).

### 1.4 Scope lock

The initial build includes strictly:
1. Customer registration (`account_type = 'customer'`) and login.
2. Admin login and server-enforced role-based access (`customer` vs `admin`).
3. Product catalog with real-time search and stock-status indicators.
4. Customer cart with live stock validation and server-side checkout recalculation.
5. Admin POS with searchable product list, customer selector (including `Walk-In Customer (POS)`), and current-sale panel.
6. Inventory viewing, product add/edit, and stock adjustments (`quantity` + synchronized `stock_status`).
7. Atomic sale recording and inventory deduction shared by Customer Checkout and Admin POS.
8. Digital receipt with cryptographically random opaque token (`GC-<12-hex>`) and locally rendered QR code.
9. Customer purchase history with ownership-protected receipt viewing.
10. Eco-Impact dashboard displaying paper saved (`sheets`) and carbon reduction (`g CO2e`) clearly labeled as documented estimates.

**Explicit exclusions for the initial version:**
- Promotions, coupons, and discount campaigns.
- Supplier and purchase-order management.
- Blog, CMS, or third-party payment gateway integration.
- A separate `seller` role beyond `customer` and `admin`.
- Water-saved metrics, category administration, or revenue forecasting not present in the submitted ERD.

---

## 2. Three-Tier Architecture & Technology Stack

### 2.1 Three-tier architecture

| Tier | Responsibility | TypeScript + Node Implementation |
|---|---|---|
| **Presentation layer** | Displays information and collects user actions | React 19 + TypeScript + Tailwind CSS v4 SPA (`src/client/*`) |
| **Application / business logic layer** | Authenticates sessions, enforces roles, validates requests, computes totals & Eco-Impact, executes atomic sales | TypeScript HTTP middleware (`src/server/apiPlugin.ts`) + `GreenCartService` (`src/server/service.ts`) |
| **Data / DBMS layer** | Stores related data and enforces FK, UNIQUE, and CHECK constraints | SQLite relational database via Node 24 built-in `node:sqlite` (`db/schema.sql`, `db/seed.sql`, `src/server/db.ts`) |

All reads and writes pass strictly through the server API layer; the browser never accesses database state directly and never acts as an authority for prices, totals, stock, or roles.

### 2.2 Stack comparison & upgrade rationale

| Layer | Previous Plan | Upgraded TypeScript + Tailwind Stack | Why Better |
|---|---|---|---|
| **Frontend UI** | PHP templates + Bootstrap 4 | **React 19 + TypeScript + Tailwind CSS v4** | End-to-end compile-time type safety, utility-first responsive layout, zero jQuery/Bootstrap bloat |
| **Icons & QR** | Local PHP QR library | **`lucide-react` + `qrcode`** | Deterministic local SVG/DataURL QR rendering + crisp lightweight vector icons |
| **Backend API** | Raw PHP 8 + PDO | **TypeScript `GreenCartService` + Vite API Middleware Plugin** | Shared interfaces (`src/shared/types.ts`) between frontend and backend; zero contract drift |
| **Database** | MySQL | **Node 24 `node:sqlite` (`DatabaseSync`) with strict SQL schema** | Zero-setup local relational engine with full `FOREIGN KEY`, `UNIQUE`, and `CHECK` enforcement + transactional `BEGIN IMMEDIATE` locking |
| **Testing** | Manual test matrix | **Vitest automated test suite (`tests/greencart.test.ts`)** | Repeatable sub-second execution of every security, atomicity, and reconciliation gate |

---

## 3. Skills, Plugins & MCP Acceleration Matrix

To keep the build fast, token-efficient, and defect-free, each phase maps directly to specialized **Plugins**, **MCP tools**, and **Agent Skills**:

| Capability | Tool / Package / Config | Phase(s) Used | Concrete Role in GreenCart |
|---|---|---|---|
| **Tailwind Vite Plugin** | `@tailwindcss/vite` | Phases 1, 3, 4 | Zero-config Tailwind CSS v4 compilation and design tokens (`brand-*` Ogani greens) |
| **React Vite Plugin** | `@vitejs/plugin-react` | Phases 1, 3, 4 | Fast TypeScript JSX transform and HMR during frontend development |
| **GreenCart API Vite Plugin** | `src/server/apiPlugin.ts` | Phases 2, 3, 4 | Embeds the authenticated `/api/*` REST server inside Vite dev/preview server with zero separate port/CORS friction |
| **MCP Servers (`.mcp.json`)** | `@modelcontextprotocol/server-filesystem`, `mcp-sqlite` | Phases 1–6 | Gives AI agents and developers direct structured inspection of `data/greencart.sqlite` rows, schema constraints, and project files |
| **Lean Build Skill** | `lean-build` | Phases 2–5 | Prevents over-engineering and scope creep; enforces strict adherence to the 7-entity ERD |
| **Design Taste Frontend Skill** | `design-taste-frontend` | Phases 3–4 | Guides typography (`Plus Jakarta Sans` + `JetBrains Mono` tabular figures), spacing, contrast, and responsive polish across Customer & POS views |
| **Verify & Stop Skill** | `verify-and-stop` | Phases 1–6 | Runs targeted `vitest` and `tsc` / `vite build` completion gates before closing any phase |

---

## 4. Database Design — Canonical Seven-Entity ERD

### 4.1 Entities and physical SQL schema (`db/schema.sql`)

All 7 logical entities from Activities 3 & 4 map 1:1 to physical relational tables with `PRAGMA foreign_keys = ON`:

| Logical Entity | Physical Table | Fields | Key & Integrity Constraints |
|---|---|---|---|
| **Account** | `accounts` | `account_id`, `username`, `password_hash`, `account_type`, `full_name` | PK `account_id`; `UNIQUE(username)`; `CHECK(account_type IN ('customer', 'admin'))` |
| **Product** | `products` | `product_id`, `product_name`, `description`, `price` | PK `product_id`; `NUMERIC(10,2)` stored & computed in integer centavos server-side; `CHECK(price >= 0)` |
| **Inventory** | `inventory` | `inventory_id`, `product_id`, `quantity`, `stock_status` | PK `inventory_id`; `UNIQUE FK product_id -> products`; `CHECK(quantity >= 0)`; `CHECK(stock_status IN ('In Stock','Low Stock','Out of Stock'))` |
| **Transaction** | `transactions` | `transaction_id`, `account_id`, `transaction_date`, `total_amount` | PK `transaction_id`; `FK account_id -> accounts`; `CHECK(total_amount >= 0)` |
| **Transaction Detail** | `transaction_details` | `detail_id`, `transaction_id`, `product_id`, `quantity`, `subtotal` | PK `detail_id`; `FK transaction_id -> transactions`; `FK product_id -> products`; `CHECK(quantity > 0)` |
| **Digital Receipt** | `digital_receipts` | `receipt_id`, `transaction_id`, `qr_code`, `receipt_date` | PK `receipt_id`; `UNIQUE FK transaction_id -> transactions`; `UNIQUE(qr_code)` |
| **Eco-Impact** | `eco_impact` | `impact_id`, `transaction_id`, `paper_saved`, `carbon_reduction` | PK `impact_id`; `UNIQUE FK transaction_id -> transactions` |

### 4.2 Documented schema decisions (Phase 0 Freeze)

- **POS Customer Association:** Admin POS selects an existing customer account or the designated `walkin_customer` account (`account_id = 3`), preserving a strict `NOT NULL` foreign key on `transactions.account_id`.
- **Money Precision:** All subtotals and `total_amount` calculations convert `price` to integer centavos (`Math.round(price * 100)`) before summing and rounding back to 2 decimals.
- **QR Token Safety:** `digital_receipts.qr_code` stores an opaque cryptographic token (`GC-<12 uppercase hex chars>` via `crypto.randomBytes(6)`), never personal data or sequential IDs alone.
- **Documented Eco-Impact Formula (Estimates Only):**
  - `paper_saved` (sheets) = `1.00 + 0.25 * distinct_line_items` (1 base receipt header/footer sheet + 0.25 sheet per item line).
  - `carbon_reduction` (g CO₂e) = `paper_saved * 3.50` (estimated thermal paper lifecycle emission factor).
  - UI clearly labels all values as **Estimates** and separates **Personal** vs **Store-Wide** totals.

---

## 5. Improved 6-Phase Implementation & Gate Plan

Each phase ends with a mandatory automated verification gate before moving forward.

### Phase 1 — Project Scaffold, MCP Config & Relational Database Foundation
- **Deliverables:** `package.json`, `tsconfig.json`, `vite.config.ts`, `.mcp.json`, `db/schema.sql`, `db/seed.sql`, `src/server/db.ts`.
- **Tasks:** Initialize TypeScript + Tailwind v4 + React 19 + Vitest; configure `node:sqlite` database initialization, foreign keys, salted `scrypt` password hashing, and deterministic seed data (4 accounts, 8 products + inventory, 3 historical sales).
- **Gate:** Database initializes cleanly from empty state, enforces FK/UNIQUE/CHECK constraints, and loads seed records.

### Phase 2 — Shared Contracts, Auth & Server-Side Business Service
- **Deliverables:** `src/shared/types.ts`, `src/server/service.ts`, `src/server/apiPlugin.ts`.
- **Tasks:**
  - Implement HMAC-signed `HttpOnly` session cookies (`gc_session`) and CSRF/origin validation.
  - Enforce customer-only registration (`account_type` hardcoded to `'customer'`).
  - Implement server-side role guards (`requireAuth`, `requireAdmin`).
  - Build idempotent/atomic `processSale()` inside `BEGIN IMMEDIATE ... COMMIT` with full rollback on invalid IDs or insufficient stock.
- **Gate:** Registration, login, invalid credentials, role-boundary rejection (`403`), and atomic rollback tests pass.

### Phase 3 — Customer Storefront, Search & Admin Inventory
- **Deliverables:** `src/client/App.tsx`, `src/client/components/AuthView.tsx`, `src/client/components/CatalogView.tsx`, `src/client/components/InventoryView.tsx`.
- **Tasks:**
  - Build Ogani-inspired Customer Catalog with search, stock-status filter (`In Stock` / `Low Stock` / `Out of Stock`), product cards, and sticky Cart Panel.
  - Build Admin Inventory console with KPI cards, quick stock adjustments (`-1`, `+1`, `+10`), and Add/Edit Product modal.
- **Gate:** Catalog search reflects live DB records; stock adjustments update `stock_status` consistently; non-admin writes fail server-side.

### Phase 4 — Shared Sale Processing: Customer Checkout & Admin POS
- **Deliverables:** `src/client/components/PosView.tsx`, Cart checkout wiring, idempotency token protection.
- **Tasks:**
  - Wire Customer Cart checkout and Admin POS ("Complete Sale and Generate QR Receipt") to the single `/api/sales` endpoint (`GreenCartService.processSale`).
  - Enforce duplicate-submission lock (`checkoutToken` + disabled UI state while pending).
  - Verify tampered browser prices/totals are ignored and recalculated on the server.
- **Gate:** Both checkout paths deduct stock atomically, reject insufficient stock cleanly, and ignore client-tampered totals.

### Phase 5 — Digital Receipts, Local QR Generation, Purchase History & Eco-Impact Dashboard
- **Deliverables:** `src/client/components/ReceiptView.tsx`, `src/client/components/HistoryView.tsx`, `src/client/components/EcoImpactView.tsx`, `src/client/components/DbInspectorModal.tsx`.
- **Tasks:**
  - Render crisp QR codes locally from `qr_code` tokens using `qrcode`.
  - Build Purchase History with per-row "View Receipt" actions and strict customer ownership verification.
  - Build Eco-Impact Dashboard with Personal / Store-Wide toggle, formula transparency banner, and live ledger reconciliation.
  - Add 7-Entity Live SQLite Inspector modal for demonstration/auditing.
- **Gate:** Valid QR scans load the exact receipt; invalid tokens fail safely; Customer A cannot read Customer B's history/receipts; Eco-Impact totals reconcile 100% with DB aggregates.

### Phase 6 — Automated Minimum Test Matrix, Typecheck & Production Build Gate
- **Deliverables:** `tests/greencart.test.ts`, `README.md`, verified `dist/` bundle.
- **Tasks:**
  - Run full Vitest Minimum Test Matrix covering every requirement in Section 8 of the baseline plan.
  - Run `npx tsc --noEmit` and `npm run build` (`vite build`).
- **Gate:** Zero TypeScript errors, clean production build, and 100% passing Vitest assertions.

---

## 6. Minimum Test Matrix (Automated Gate Checklist)

| Area | Automated Assertion | Expected Result |
|---|---|---|
| Registration | Register valid customer / attempt `account_type: 'admin'` | Creates `'customer'` only with `scrypt` password hash |
| Authentication | Wrong password / missing session | Fails safely (`401`) without leaking account secrets |
| Authorization | Customer invokes admin product/stock/POS endpoints | Rejected with `403 Forbidden` |
| Catalog & Inventory | Search query + negative stock rejection | Matching items returned; negative quantity throws error |
| Pricing Integrity | Tamper item price or total in request payload | Server recalculates authoritative price & total from DB |
| Atomic Sale & Rollback | Checkout exceeding stock or mid-transaction failure | Entire transaction rolls back; stock and tables stay untouched |
| Idempotency | Submit identical `checkoutToken` twice | Processed once; second returns error or existing receipt without double deduction |
| QR Receipt & Ownership | Valid token lookup, invalid token lookup, cross-customer transaction lookup | Valid returns receipt; invalid fails safely (`404`); cross-customer private lookup denied (`403`) |
| Eco-Impact | Reconcile dashboard sums vs `SELECT SUM(...) FROM eco_impact` | Exact mathematical match for both personal and store-wide scopes |
