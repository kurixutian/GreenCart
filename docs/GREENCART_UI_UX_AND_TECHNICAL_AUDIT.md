# GreenCart — UI/UX & Technical Audit and Improvement Roadmap

> **Source Assessed:** `kurixutian/GreenCart` (`main` branch)  
> **Assessment Summary:** GreenCart has moved beyond a simple mockup. It now has a React 19 + TypeScript frontend, Tailwind CSS 4, a Node.js SQLite backend, customer/admin role separation, QR receipts, inventory handling, and automated tests.  
> **Next Objective:** Rather than adding lots of features, make the customer and admin experiences feel like a coherent, polished retail application while tightening reliability, mobile usability, and the checkout workflow.

---

## Key Architectural Distinction

The repository currently contains separate customer and admin screens, but the shared application shell (`App.tsx`) still uses a fairly similar top-navigation pattern for both. Customer and admin roles should receive distinct layouts, navigation structures, and interaction patterns rather than applying the same visual redesign to every screen.

---

## 1. Prioritized Improvements

### P0 — Separate the customer and admin application shells
The current `App.tsx` uses one shared header and navigation structure. The two roles should have distinct layouts, navigation, and interaction patterns.

### P0 — Improve mobile usability
The customer catalog, cart, POS register, and inventory table need deliberate mobile layouts, not just smaller desktop layouts.

### P1 — Make the customer shopping experience more complete
Improve product discovery, product details, cart feedback, checkout confirmation, receipt access, and purchase history.

### P1 — Improve admin operational efficiency
Make POS faster to use, make stock problems obvious, and improve inventory search and editing.

### P2 — Strengthen security, testing, and maintainability
Address development configuration, receipt-token strength, session expiration, and missing browser-level UI tests.

---

## 2. Customer UI Redesign

**Design Direction:** Make the customer portal feel like a proper eco-friendly online store, not an administrative system with shopping features.

### A. Customer navigation

| Desktop | Mobile |
|---|---|
| Compact top navigation | Bottom navigation |
| Logo and Catalog | Home |
| Purchase History | History |
| Eco-Impact | Eco-Impact |
| Account menu | Account |
| Cart indicator | Persistent cart button |

The mobile navigation should remain visible without taking excessive screen space.

### B. Customer catalog

**Current implementation:** `CatalogView.tsx` already supports product search, stock filtering, cart quantities, and checkout.

**Improvements:**
- More attractive product presentation and clearer product names.
- Product images, if the group approves extending the product data model.
- Clear stock labels and unavailable-product states.
- Better search and category/filter controls.
- Sorting by name and price.
- Product details in a dedicated modal or detail view.
- A visible cart count and clear add-to-cart feedback.

> [!IMPORTANT]
> **Database Constraint:** The current seven-entity ERD does not include a product image field or category entity. Do not silently add these to the database. Use existing product information for the first redesign and treat image/category support as an optional scope change.

### C. Shopping cart

- **Desktop:** Collapsible cart drawer or dedicated side panel.
- **Mobile:** Bottom-sheet cart.
- Quantity controls with clear minimum and stock limits.
- Remove item action.
- Subtotal and total displayed clearly.
- Eco-impact estimate shown separately from the actual amount due.
- Checkout confirmation before submitting.
- Loading and success states.

The cart should never force customers to navigate away from the catalog just to check their order.

### D. Digital receipt

Improve `ReceiptView.tsx` with:
- Prominent QR code (easy to scan on a phone).
- Transaction number and date.
- Customer name.
- Purchased products, quantities, and subtotals.
- Total amount.
- Paper saved and estimated carbon reduction.
- Print-friendly receipt layout.
- Clear return-to-catalog and purchase-history actions.

### E. Purchase history and Eco-Impact

**Purchase History:**
- More readable transaction cards on mobile.
- Search by transaction number.
- Date and amount clearly visible.
- Easy receipt reopening.

**Eco-Impact:**
- Three primary metrics: paper saved, estimated carbon reduction, and paperless transactions.
- A simple progress or cumulative-impact visualization.
- Personal impact for customers; store-wide impact for administrators.
- A clearly accessible explanation of the calculation method.

> [!NOTE]
> Preserve the distinction between estimates and measured scientific results; keep all environmental values clearly labeled as estimates.

---

## 3. Admin UI Redesign

**Design Direction:** Prioritize speed, clarity, and operational control. It should not look like the customer storefront.

### A. Admin application shell

Dedicated admin navigation structure:
- **GreenCart Admin** (Administrator workspace)
  - Dashboard *(proposed enhancement summarizing existing data without unsupported metrics)*
  - **POS Terminal**
  - Inventory
  - Digital Receipts
  - Eco-Impact

### B. POS terminal

Retain the useful two-column layout in `PosView.tsx` (products on the left, current sale on the right) and enhance both viewports:

**Desktop improvements:**
- Product search at the top.
- More compact product selection grid.
- Clear stock availability.
- Persistent current-sale panel with customer selector, item quantity controls, subtotal, total, and a large, prominent complete-sale action.

**Mobile improvements:**
- Product list occupies the main screen.
- Current sale becomes a bottom drawer.
- Cart quantity appears in a floating or fixed action.
- Checkout summary remains visible with touch-friendly controls.

> [!WARNING]
> **Functional Issue to Address:** `PosView.tsx` currently initializes `selectedCustomerId = 3`. Defaulting to a hard-coded database ID is fragile. Replace this with a deliberate customer-selection default and reconcile the Walk-In Customer option with the build plan before development.

### C. Inventory management

Improve `InventoryView.tsx` with:
- Search and stock-status filters.
- Total SKU, in-stock, low-stock, and out-of-stock summaries.
- Better table readability and clear stock quantity indicators.
- Inline stock adjustment or compact adjustment dialog.
- Product editing in a well-structured form.
- Confirmation before destructive actions.
- Responsive mobile inventory cards instead of a horizontally overflowing table.

### D. Admin receipts and Eco-Impact

Admins should be able to:
- Open generated receipts and inspect QR receipt information.
- Review transaction details.
- View store-wide paper savings, estimated carbon reduction, and the transaction ledger.

Do not introduce advanced accounting, revenue forecasting, supplier management, or other features unless the group explicitly expands the project scope.

---

## 4. Technical Improvements Identified

| Area | Current observation | Recommended improvement |
|---|---|---|
| UI architecture | Shared role-based shell in `App.tsx` | Separate customer and admin layouts |
| UI components | Custom components and Tailwind | Establish reusable design tokens and component patterns |
| Browser tests | Vitest tests exist; no Playwright dependency in `package.json` | Add browser-level tests |
| Database | SQLite, seven canonical entities | Preserve existing ERD |
| Authentication | scrypt password hashing and signed sessions | Add session expiration and production secret requirements |
| QR tokens | Six random bytes (48 bits) in `crypto.ts` | Increase token entropy (at least 128 bits) and test collision handling |
| MCP config | Absolute local filesystem/database paths in `.mcp.json` | Document per-developer MCP configuration |
| Documentation | README / plan mentions `lucide-react` | Align documentation with actual dependencies (inline SVG icons) |

### Priority Security Hardening Items
1. **Production Session Secret & Expiration (`apiPlugin.ts` / `crypto.ts`):** Production deployments must require a strong externally configured secret rather than silently falling back to a development string, and signed session tokens should enforce expiration (`exp`).
2. **Higher-Entropy QR Receipt Tokens (`crypto.ts`):** Increase `generateOpaqueReceiptToken()` from 6 random bytes (48 bits) to at least 16 random bytes (128 bits) while preserving opaque QR-based lookup and collision testing.
3. **Browser-Level Testing:** Complement existing Vitest service/API tests with Playwright tests verifying customer and admin flows across mobile and desktop viewports.

---

## 5. Recommended Skills, Plugins, and MCP Tools

### Primary Skills

1. **Impeccable** *(Primary UI skill)* — UX critique, layout, accessibility, responsive adaptation, design tokens, and interface polishing (`critique`, `shape`, `document`, `adapt`, `audit`, `polish`). Let Impeccable's Operate-mode guidance drive dense POS and inventory design.
2. **Taste (`design-taste-frontend` / Frontend UI Engineering)** — Implementing React interfaces, responsive layouts, accessible controls, and reusable components alongside Impeccable.
3. **Ponytail (`ponytail` / `ponytail-review`)** — Post-redesign simplification to trim unnecessary abstractions, duplicated UI, and dependencies without changing behavior.
4. **Caveman (`investigate-first` / `caveman-review`)** — Evidence-based bug investigation prior to editing and concise diff review before merging.

### MCP & QA Tooling

| Tool / MCP | Status / Purpose | Priority |
|---|---|---|
| GitHub MCP | Repository inspection, branches, commits, PRs | Essential |
| Filesystem MCP | Configured in `.mcp.json` (document per-developer paths) | Essential |
| SQLite MCP | Configured in `.mcp.json` | Essential |
| Playwright + Playwright MCP | Real browser interaction, screenshots, and automated regression tests | High |
| `@axe-core/playwright` | Automated accessibility testing inside browser tests | High |
| Lighthouse CI | Performance and accessibility checks | Medium |

> [!NOTE]
> `.mcp.json` currently uses machine-specific absolute paths (`/home/kurixutian/projects/GreenCart`). Document how each contributor configures their local workspace path. Keep repeatable automated regression tests in Playwright inside the repo rather than relying solely on interactive MCP checks.

---

## 6. Six-Phase Implementation Roadmap

Complete each phase and pass its verification gate before proceeding to the next.

1. **Phase 0 — Reconnaissance and baseline (First)**
   - Inspect complete repository; run existing tests and production build.
   - Capture desktop and mobile screenshots and record existing user journeys.
   - Identify functional/visual regressions and document the existing design system.
   - **Deliverable:** UI and technical audit report (`docs/GREENCART_UI_UX_AND_TECHNICAL_AUDIT.md`).

2. **Phase 1 — Design system and application shells**
   - Establish colors, typography, spacing, buttons, inputs, dialogs, and status styles.
   - Separate customer and admin layouts with distinct desktop and mobile navigation and responsive breakpoints.
   - **Deliverable:** Reusable GreenCart design system and two application shells.

3. **Phase 2 — Customer portal redesign**
   - Catalog and product discovery (sorting, details modal/view, clear availability).
   - Shopping cart drawer (desktop) and bottom sheet (mobile) with confirmation and feedback states.
   - Print-friendly digital receipt & prominent QR display, mobile-friendly purchase history, and Eco-Impact view.
   - **Deliverable:** Complete responsive customer experience.

4. **Phase 3 — Admin portal redesign**
   - Dedicated admin navigation and overview.
   - POS terminal and current-sale panel (desktop split view + mobile bottom drawer), resolving the hard-coded default customer ID.
   - Inventory management (mobile card view + desktop table, inline/dialog adjustments, destructive confirmations).
   - Receipt inspection and store-wide Eco-Impact view.
   - **Deliverable:** Complete responsive admin experience.

5. **Phase 4 — Backend and security hardening**
   - Session expiration and strict production `GREENCART_SESSION_SECRET` enforcement.
   - Higher-entropy (≥128-bit) QR tokens with collision handling tests.
   - Checkout validation, inventory consistency, API authorization, and error handling review.
   - **Deliverable:** Hardened, production-ready application server.

6. **Phase 5 — QA and final refinement**
   - Playwright end-to-end customer and admin workflows across mobile and desktop viewports.
   - `@axe-core/playwright` accessibility checks and Lighthouse CI performance/accessibility verification.
   - Full regression testing (`vitest`, `playwright`, `tsc --noEmit`, `vite build`).
   - **Deliverable:** Verified project release candidate.

---

## 7. Testing Gates

| Phase | Required verification |
|---|---|
| 0 | Existing tests and build pass; baseline documented |
| 1 | Both customer and admin layouts work at mobile and desktop widths |
| 2 | Customer can browse, add to cart, checkout, and view receipt |
| 3 | Admin can process a POS sale and manage inventory |
| 4 | Unauthorized requests fail; checkout and stock remain consistent |
| 5 | Browser workflows, accessibility, and production build pass |

> [!CAUTION]
> Never allow a UI redesign to silently break existing checkout atomicity, transaction integrity, digital receipt lookup, or Eco-Impact calculations.

---

## 8. Recommended Design Direction

Maintain a consistent GreenCart identity with distinct visual density per role:

- **Customer Portal:** Bright, welcoming, botanical green identity, product-focused, spacious layouts, easy mobile shopping.
- **Administrator Portal:** Operational and structured, neutral surfaces, green reserved for primary actions, compact information hierarchy, fast keyboard and touch workflows.

Avoid excessive gradients, glassmorphism, oversized dashboard cards, and decorative animations.

---

## 9. Recommended Execution Order

Do not attempt to redesign all of GreenCart in a single prompt—the repository contains working business logic that must be preserved. Follow this sequence:

1. Strong coding model (e.g., Argon) for initial repository audit and architectural decisions.
2. **Impeccable** for design critique and screen-by-screen design plan.
3. **Taste** for React/Tailwind implementation.
4. **Playwright + Playwright MCP** for visual and functional browser verification.
5. **Ponytail** and **Caveman** for simplification, cleanup, and diff review.

---

## 10. Phase 0 Baseline Snapshot

- **Existing Tests & Build:** `npx vitest run tests/greencart.test.ts` (`7/7` tests passing), `tsc --noEmit` (`0` errors), `vite build` (`90` modules transformed, clean bundle in `dist/`).
- **Design Tokens (`src/client/index.css`):** `Plus Jakarta Sans` UI sans, `JetBrains Mono` tabular figures, and Ogani botanical palette (`brand-50` `#f4f9ee` through `brand-900` `#35491e`).
- **Baseline UI Architecture:** `App.tsx` previously rendered one shared navigation header for both `customer` and `admin`; `PosView.tsx` defaulted `selectedCustomerId` to hard-coded `3`; `ReceiptView.tsx` lacked print actions; `HistoryView.tsx` and `InventoryView.tsx` rendered desktop tables without dedicated mobile card views; `crypto.ts` generated 48-bit receipt tokens without session `exp`.
