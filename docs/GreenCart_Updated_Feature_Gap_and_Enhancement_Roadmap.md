# GreenCart — Updated Feature Gap Analysis & Enhancement Roadmap

**Repository:** https://github.com/kurixutian/GreenCart  
**Reviewed branch:** `main`  
**Reviewed commit:** `0baa97cab07586a2df92b8045de2305d663da4e7`  
**Commit date:** 18 November 2026, 05:27 UTC  
**Purpose:** Reconcile the latest implementation with the existing audit and project documents, identify what is genuinely still missing, and define a safe roadmap for additional useful features.

> **Status rule:** This plan distinguishes (1) features already implemented in the reviewed commit, (2) gaps confirmed by the current schema/code, and (3) proposed enhancements that need group approval. Re-check `main` before implementation because the repository may change again.

---

## 1. Executive summary

The latest repository update resolves much of the earlier audit backlog. GreenCart now has separate customer and admin shells, a dashboard, mobile navigation and mobile-specific workflows, improved catalog/cart interactions, enriched printable receipts, rolling session expiry, stronger receipt tokens, Playwright browser tests, Axe accessibility checks, and a CI workflow.

The next step is therefore **not to repeat the old P0/P1/P2 implementation plan**. The main remaining product gaps are:

1. Product images and optional image galleries.
2. Product categories and richer product management.
3. A decision on whether a distinct Seller role is actually required.
4. A decision on whether water saved is a real requirement; the current Activity 3 and Activity 4 documents do not specify it.
5. Further useful retail workflows: SKU/barcode support, transaction search/reporting, stock-adjustment history, product archiving, and customer account controls.
6. Broader QA coverage across all key screens and failure paths.
7. Updating older roadmap documents so they reflect the new implementation.

**Recommended approach:** preserve the working seven-entity system, finish specification reconciliation, approve schema changes, then implement optional product-data features and operational enhancements in controlled phases.

---

## 2. Latest repository status

The reviewed `main` commit is:

`0baa97cab07586a2df92b8045de2305d663da4e7`

Commit message: `feat(P0-P2): complete mobile 375px audit, UX enhancements, rolling 30m sessions, and CI`

### 2.1 Confirmed implemented in the reviewed source

| Area | Current implementation found | Status |
|---|---|---|
| Role-specific UI | `CustomerShell.tsx` and `AdminShell.tsx` | Implemented |
| Admin overview | `AdminOverviewView.tsx` | Implemented |
| Mobile navigation | Separate customer/admin bottom navigation | Implemented |
| Customer catalog | Search, stock filtering, sorting, URL-persisted sort, product detail modal | Implemented |
| Cart | Cart count, add-to-cart feedback, localStorage persistence, mobile cart behavior | Implemented |
| Checkout | Review/confirmation flow, pending state, completion feedback | Implemented |
| POS | Responsive register, mobile drawer, keyboard shortcuts, dynamic Walk-In Customer selection | Implemented |
| Inventory | Search/filtering, stock-priority sorting, inline price/quantity editing, mobile card layout | Implemented |
| Purchase history | Search and mobile transaction cards | Implemented |
| Receipt | Itemized details, QR token, print action and print stylesheet | Implemented |
| Session security | Rolling 30-minute signed session expiry and idle warning flow | Implemented |
| Production secret | Production requires `GREENCART_SESSION_SECRET`; secure cookies enabled in production | Implemented |
| QR token entropy | 16 random bytes (128 bits) | Implemented |
| Browser tests | Playwright desktop and mobile projects, customer/admin workflows | Implemented |
| Accessibility tests | `@axe-core/playwright` WCAG 2A/2AA checks in E2E suite | Implemented |
| CI | GitHub Actions runs unit tests, build and Playwright E2E | Implemented |
| Playwright MCP | Present in `.mcp.json` | Configured |

These items should be treated as **completed baseline capabilities**, not fresh implementation tasks. They still need regression testing when related code changes.

### 2.2 Confirmed gaps in the current schema

The latest `db/schema.sql` still defines the canonical seven entities. The `products` table contains product name, description and price, but no image or category field. The `accounts.account_type` check currently allows only `customer` and `admin`. The `eco_impact` table stores `paper_saved` and `carbon_reduction`, not water saved.

| Feature | What the current schema shows | Next action |
|---|---|---|
| Product image | No image reference/field/table | Approve data-model approach |
| Product gallery | No image collection/table | Optional; approve only if gallery is needed |
| Product category | No category field/entity | Approve category model |
| Seller role | Only `customer` and `admin` values | Check signed-off role requirements |
| Water saved | Only paper and carbon metrics | Verify exact approved requirement/formula |

### 2.3 Existing documentation needs reconciliation

The repository contains both `GREENCART_UI_UX_AND_TECHNICAL_AUDIT.md` and `GreenCart_Missing_Features_Plan.md`.

The audit now has a resolved-items section marking much of P0–P2 complete, but its older baseline section still describes the previous shared shell, old receipt behavior and old token/session state. The missing-features plan also retains outdated statements about Playwright not being installed, old source paths, and an outer Markdown code fence.

**Documentation task:** update or supersede stale status statements. Avoid maintaining two competing roadmaps with different implementation status.

---

## 3. Reconcile project requirements before adding features

The project documents currently present in `docs/` were checked:

- `Group4_Act.3 (1).md`
- `Group4_Act.4 (1).md`
- `Group4_Wireframe.md`

### 3.1 What those documents actually specify

Activity 3 describes:
- Customer Portal.
- Admin/POS Dashboard for store managers to process sales and manage products.
- Product Catalog.
- Digital Receipt/QR View.
- Eco-Impact Dashboard for estimated paper savings and carbon-footprint reductions.
- Customer and administrator accounts.
- The seven-table relational model.

Activity 4 specifies seven entities:
1. Account.
2. Product.
3. Inventory.
4. Transaction.
5. Transaction Detail.
6. Digital Receipt.
7. Eco-Impact.

Its Eco-Impact entity contains **paper saved and carbon reduction**. The wireframe also mentions paper saved, carbon reduction and paperless transaction counts.

### 3.2 Seller role: not established by the checked project documents

The checked Activity 3 document says customers and store administrators, and describes an Admin/POS dashboard. Activity 4 describes Account as storing customer and administrator account information. The current schema likewise permits only `customer` and `admin`.

Therefore, a separate `seller` role is **not established by the Activity 3/4 documents currently in the repository**. Do not add it merely because a Seller/POS role might be common in retail software.

If another approved PDF or signed-off requirement explicitly defines Seller separately, add that source to the project documentation and define the exact permission differences before changing authentication or schema.

### 3.3 Water saved: not established by the checked project documents

The checked Activity 3 and Activity 4 documents describe paper savings and carbon reduction. They do not specify a water-saved field or formula. The current seven-entity schema also has no water metric.

Do not create a water-saved number or conversion factor based only on an unsupported assumption. Locate the exact requirement in the approved proposal/PDF and document:
- Unit.
- Per-transaction calculation.
- Formula and source assumptions.
- Whether it is estimated or measured.
- Migration/backfill behavior for existing transactions.

Until that evidence exists, keep water saved **pending approval**, not in the implemented metric set.

### 3.4 Product images and categories: useful enhancements, not present in the checked ERD

The checked Activity 3/4 documents describe Product using product name, description and price. They do not specify images or categories. These are reasonable product improvements, but require an explicitly approved scope/schema update before implementation.

---

## 4. Remaining product gaps and recommended features

### 4.1 Product images — recommended

**Current gap:** no image data is represented in the current Product schema.

Suggested capability:
- Primary product image on catalog cards.
- Larger image in product detail.
- Consistent placeholder for missing images.
- Admin upload/change image.
- Image validation and size limits.
- Responsive image sizing and descriptive alt text.

**Choose one data-model approach:**

**A. Single image per product**
- Add a nullable image reference to Product.
- Simpler for an academic application with a small catalog.

**B. Multiple images per product**
- Add a `product_images` table linked to Product.
- Store image reference and display order.
- Use a carousel only on the product detail view, not as unnecessary motion on every product card.

Do not store large image binaries directly in SQLite without a clear reason. Store image files in a controlled media directory or approved storage service and keep references in the database. Define backup and file-cleanup behavior.

Acceptance criteria:
- [ ] Product cards show an image or deliberate fallback.
- [ ] Product detail displays the primary image.
- [ ] Admin can upload/change images if upload is in approved scope.
- [ ] Invalid formats, oversized files and failed uploads are handled safely.
- [ ] Images remain responsive and have useful alternative text.
- [ ] ERD, SQL schema and migration are updated together.

### 4.2 Product categories — recommended

Suggested capability:
- All Products view.
- Category filter.
- Category assignment on product create/edit.
- Search and category filters combine correctly.
- Clear empty-category behavior.

Data model:
- Use a simple `category` field on Product only if categories are fixed and are not independently managed.
- Use a separate Category entity/table if administrators need to add, rename, deactivate or manage categories.

Do not build a category management screen without deciding how categories are stored and maintained.

Acceptance criteria:
- [ ] Approved category model is documented.
- [ ] Admin can assign/update category.
- [ ] Customer can filter by category.
- [ ] Search, stock filter and category filter work together.
- [ ] ERD, SQL schema, migration and test data remain aligned.

### 4.3 SKU/barcode support — useful POS enhancement

The current product structure does not include a dedicated SKU/barcode attribute. A POS search by product name works, but SKU/barcode lookup can make checkout faster.

Proposed capability:
- Optional unique SKU or barcode field.
- POS search by exact SKU/barcode and by product name.
- Keyboard-first workflow: focus search, enter code, add matching available product.
- Clear message for unknown or duplicate codes.

This is an optional data-model extension. Do not claim hardware barcode-scanner integration unless the actual scanner/browser behavior has been tested. Most keyboard-emulating scanners can be treated as keyboard input, but device compatibility must be verified.

### 4.4 Product lifecycle / archive

Avoid deleting products that are referenced by historical transaction details. The current foreign-key design protects historical transaction references.

A useful enhancement is to mark a product inactive/archived so it no longer appears in the customer catalog or new POS sales while historical receipts remain intact.

This requires a product status field and a clear rule for existing inactive products. It is a schema change and should be approved.

### 4.5 Inventory adjustment history — optional, valuable for accountability

Current inventory features support viewing and changing stock, but an adjustment history would answer:
- Who changed the quantity?
- When was it changed?
- Was stock added or removed?
- Why was the adjustment made?

A robust history normally needs a new inventory movement/adjustment entity linked to Product and Account, with quantity delta, timestamp and reason. This adds scope beyond the canonical seven entities; implement only if the group approves the ERD extension.

### 4.6 Searchable admin transaction history — useful operational enhancement

A dedicated admin transaction list can make receipts easier to locate after a sale.

Potential capabilities:
- Search transaction number or receipt token.
- Filter by date range.
- Filter by customer.
- View transaction details and QR receipt.
- Sort newest/oldest and by total.
- Export CSV only if the group needs it and access controls are tested.

First inspect current AdminOverview and Eco-Impact ledger to avoid duplicating an existing capability. Prefer reusing existing transaction data/API rather than introducing duplicate records.

### 4.7 Customer account controls — optional

Potential additions:
- View account details.
- Update full name.
- Change password with current-password verification.
- Sign out from the active session.

Do not add personal addresses, phone numbers or other personal data unless the project needs them. Minimize the amount of customer data collected.

### 4.8 Low-stock threshold configuration — optional

Inventory already displays stock statuses and prioritizes low/out-of-stock items. A useful next step could be a configurable reorder threshold.

Possible approaches:
- One global low-stock threshold.
- Per-product minimum stock quantity.

Per-product thresholds require a Product field and migration. Choose the simpler approach unless the use case genuinely needs different thresholds for different products.

### 4.9 Sales and inventory export — optional

CSV export can help an administrator inspect records outside the application:
- Inventory snapshot.
- Transaction list.
- Eco-Impact ledger.

Exports must be permission-protected, correctly escaped, and limited to the intended data. This is not necessary for the core academic demonstration unless the group specifically wants reporting/export functionality.

---

## 5. Customer and admin UI: what to polish next

The separate shells and responsive navigation are now implemented. Focus on quality and consistency rather than rebuilding them.

### Customer portal

- Catalog: integrate real product images only after image data/storage is approved.
- Catalog: add category filtering only after the category model is approved.
- Product detail: present image, full description, price and availability clearly.
- Cart: verify persisted cart entries are revalidated against current server prices and stock at checkout.
- Checkout: test changed stock, failed requests, repeated clicks and refresh during submission.
- History: verify date/price formatting and clear empty/no-results states.
- Receipt: verify QR scanning, print layout, long product names and narrow screens.
- Eco-Impact: explain calculation assumptions and distinguish estimates from measured outcomes.

### Admin portal

- POS: add barcode/SKU search only if approved; preserve existing keyboard shortcuts.
- POS: verify walk-in account association and avoid hard-coded account IDs.
- POS: show price/stock changes discovered at checkout.
- Inventory: make stock status and inline edit errors clear.
- Inventory: define the low-stock threshold and whether it can be configured.
- Dashboard: ensure each metric is sourced from persisted data and labeled precisely.
- Transactions: consider a dedicated search/history screen if the existing receipt/ledger views are insufficient.

### Shared interface quality

- Consistent input, dialog, button, status and empty-state behavior.
- Keyboard focus and Escape handling.
- Loading states that prevent duplicate actions.
- Clear server-side validation messages.
- No horizontal overflow at 375px.
- Minimum 44px touch targets for major mobile actions.
- Print layout should exclude navigation and modal controls.

---

## 6. Engineering and security follow-up

Several major security items are now implemented, but should remain regression-tested.

| Area | Latest status found | Further action |
|---|---|---|
| Session expiry | Signed tokens include `exp`; rolling 30-minute session described in audit | Add automated expiry/refresh regression tests |
| Idle warning | Audit marks a 25-minute warning modal complete | Test stay-logged-in, logout and expiry edge cases |
| Production secret | Production requires `GREENCART_SESSION_SECRET` | Verify deployment documentation and secret strength policy |
| Secure cookies | Secure attribute enabled in production | Verify HTTPS deployment and cookie settings |
| QR token | 16 random bytes / 128-bit token | Preserve uniqueness and invalid-token tests |
| CSRF | CSRF cookie/header handling exists in API middleware | Keep CSRF tests for state-changing operations |
| Role access | Customer/admin roles enforced in API | Test direct unauthorized API calls and receipt ownership |
| Checkout | Transaction service uses database transactions | Test rollback, duplicate requests and stock contention |

Do not mark a security property complete solely because code exists. Keep tests for the intended behavior.

---

## 7. Testing: expand coverage rather than reinstall tools

The latest repository includes:
- `@playwright/test`.
- `@axe-core/playwright`.
- `playwright.config.ts`.
- `tests/e2e.spec.ts`.
- Desktop project at 1440×900.
- Mobile project at 375×667.
- A GitHub Actions workflow that runs tests, build and Playwright E2E.

Therefore, Playwright is **not a missing dependency**. The remaining opportunity is to broaden the test matrix.

### Current browser E2E coverage found

The browser test file includes customer and admin flows, including:
- Customer demo login.
- Mobile horizontal-overflow check.
- Catalog accessibility scan.
- Product sorting and URL persistence.
- Product detail modal and Escape close.
- Cart persistence after reload.
- Checkout confirmation.
- QR receipt token URL.
- Purchase history and Eco-Impact navigation.
- Admin dashboard.
- POS customer default and keyboard search/add flow.
- Inventory navigation, overflow check and low-stock ordering.

### Recommended additional browser tests

**Customer**
- Insufficient stock at checkout.
- Price/stock changed after cart creation.
- Checkout network/server error preserves cart.
- Repeated checkout click does not create duplicate transactions.
- Receipt QR token invalid/unknown.
- Customer cannot view another customer's receipt.
- Axe scan on receipt, history and Eco-Impact, not only catalog.

**Admin**
- Customer role cannot open admin APIs.
- POS with empty cart cannot submit.
- Unknown SKU/barcode behavior if added.
- Inventory form rejects invalid price/quantity.
- Inline update failure is visible and recoverable.
- Axe scan on POS and Inventory, not only dashboard.
- Session idle warning, refresh and expiry behavior.

**Future data-model features**
- Product image upload validation and missing-image fallback.
- Category filtering and category assignment.
- SKU uniqueness and barcode search.
- Archived product behavior.
- Stock adjustment history integrity.

### Lighthouse

`@lhci/cli` is present in `package.json`, but the reviewed CI workflow runs unit tests, build and Playwright; a Lighthouse CI job/configuration was not observed in the reviewed file tree. Treat Lighthouse as **available as a dependency but not yet a confirmed CI quality gate**. Add it only after deciding which routes and thresholds are meaningful.

---

## 8. Skills, plugins and MCP to use

Use a small, complementary toolset. These are installed/configured capabilities found in this workspace/repository; availability in another developer's environment may differ.

### Installed skills

1. **Impeccable — primary UX/UI workflow**
   - `critique`: evaluate current customer/admin screens.
   - `shape`: plan a specific screen or workflow before implementation.
   - `document`: capture design tokens and existing design language.
   - `adapt`: fix responsive behavior.
   - `audit`: accessibility, responsive and performance review.
   - `polish`: final refinement.
   - Use Operate-mode principles for POS/inventory: scanability and task speed before decoration.

2. **Taste — frontend UI engineering**
   - Implement React/TypeScript components and responsive layouts.
   - Build accessible controls and reusable UI patterns.
   - Use the frontend engineering workflow for dense product UI; do not apply landing-page patterns to POS tables.

3. **Ponytail — code simplification**
   - Remove duplicated styling/components and unnecessary abstractions after behavior is correct.
   - Preserve existing behavior and avoid unnecessary package additions.

4. **Caveman — investigation/review**
   - Use `investigate-first` before editing a bug.
   - Use `caveman-review` for focused diff review.
   - Use `cavecrew` only where independent investigation/build/review tasks can genuinely be split.

### MCP and QA tools

| Tool | Latest status | Recommended use |
|---|---|---|
| GitHub MCP | Available | Inspect branch/commit, review changes and manage PR workflow |
| Filesystem MCP | Configured in `.mcp.json` | Local source/document inspection |
| SQLite MCP | Configured in `.mcp.json` | Inspect database schema and development data |
| Playwright MCP | Configured in `.mcp.json` | Interactive browser inspection and screenshots |
| Playwright test runner | Installed and in CI | Repeatable browser regression tests |
| Axe Playwright | Installed and used in E2E | Automated WCAG checks |
| Lighthouse CI | Package installed; CI gate not confirmed | Add route-specific performance checks if useful |

**Configuration note:** `.mcp.json` still contains machine-specific local paths. Each contributor should configure the actual local repository/database path on their machine. Do not assume all group members use the same directory. Never put secrets in MCP configuration committed to Git.

---

## 9. Prioritized enhancement roadmap

The earlier P0–P2 audit tasks are largely complete. Use the following updated roadmap.

### Phase 0 — Reconcile and clean documentation

Goal: make the repository's documentation truthful and consistent with the latest implementation.

Tasks:
- Update stale baseline notes in `GREENCART_UI_UX_AND_TECHNICAL_AUDIT.md`.
- Mark completed P0–P2 items as completed in one canonical status table.
- Remove contradictory statements that Playwright is missing.
- Fix the outer code fence in `GreenCart_Missing_Features_Plan.md`.
- Correct stale source paths (for example, use `src/client/components/` rather than old generic paths).
- Link feature decisions to Activity 3/4 and the approved proposal.
- Create one canonical roadmap or state clearly which file supersedes the others.

Deliverable: current audit and roadmap documentation.

**Gate:** a new developer can read the docs and understand what exists, what is missing, and what requires approval.

### Phase 1 — Product data expansion (Implemented)

Goal: make the catalog more visual and easier to browse.

Tasks:
- [x] Single primary image (`products.image_url`) + curated botanical illustrations (`public/images/products/`).
- [x] Fixed category attribute (`products.category`) with `idx_products_category` index.
- [x] Updated ERD amendment (`Group4_Act.4 (1).md`), `db/schema.sql`, `db/migrations/001_phase1_product_images_and_categories.sql`, and automatic backfill in `src/server/db.ts`.
- [x] Added admin image upload endpoint (`POST /api/uploads/product-image`) with MIME, 2MB limit, and safe SVG/URL validation.
- [x] Added category assignment in `InventoryView` and URL-persisted `?category=` filtering in `CatalogView` + POS category filters.
- [x] Added fallback `/images/products/placeholder.svg` and responsive `alt`-labeled images.
- [x] Added Vitest and Playwright E2E + Axe checks.

Deliverable: product images and categories.

**Gate:** current products still load; image/category data is valid; admin and customer views agree.

### Phase 2 — POS and product lookup enhancements

Goal: speed up sales processing.

Tasks:
- Decide whether SKU/barcode is required.
- Add SKU/barcode field and uniqueness rule if approved.
- Implement POS exact-match lookup and keyboard-first behavior.
- Preserve existing F2/Enter/F4/Escape shortcuts.
- Verify Walk-In Customer behavior and transaction account association.
- Add browser tests for normal and invalid scans/searches.

Deliverable: faster, more reliable POS product lookup.

**Gate:** products can be found and added without bypassing stock validation.

### Phase 3 — Inventory accountability

Goal: improve stock control beyond basic quantity editing.

Tasks:
- Decide global vs per-product low-stock threshold.
- Add configurable threshold if justified.
- Decide whether stock adjustment history is required.
- If approved, add a movement/adjustment entity with actor, timestamp, quantity delta and reason.
- Consider product archive status to preserve historical transactions without offering inactive products for sale.
- Add tests for thresholds, audit history and archived products.

Deliverable: more accountable inventory management.

**Gate:** historical transactions remain intact and inventory records remain consistent.

### Phase 4 — Admin transaction discovery and customer account controls

Goal: help users retrieve records and maintain accounts.

Tasks:
- Evaluate whether current admin overview, receipt view and Eco-Impact ledger are enough.
- If needed, add searchable transaction history with date/customer/token filters.
- Add CSV export only if the group requires it.
- Consider customer profile/password update functions.
- Apply ownership checks and minimize personal data.
- Test unauthorized and invalid requests.

Deliverable: better record retrieval and basic account controls, where approved.

**Gate:** no new page duplicates existing behavior and all sensitive data remains protected.

### Phase 5 — Eco-Impact specification decision

Goal: ensure sustainability metrics are accurate and defensible.

Tasks:
- Keep paper saved and carbon reduction as the documented metrics.
- Ask the group/adviser for the exact source if water saved is required.
- Approve the metric, unit, formula and assumptions before schema/UI changes.
- If approved, update ERD, schema, migration, seed data, calculation code, receipts and dashboard.
- Add calculation tests and label estimated values clearly.

Deliverable: approved Eco-Impact model and transparent methodology.

**Gate:** every displayed metric traces to a project requirement and documented formula.

### Phase 6 — Full QA and release readiness

Goal: verify the expanded application.

Tasks:
- Run Vitest and production build.
- Run Playwright desktop/mobile tests.
- Expand Axe audits to all key screens.
- Test sessions, CSRF, authorization, receipt ownership and checkout failures.
- Test upload validation if images are implemented.
- Add Lighthouse CI only with agreed targets.
- Capture final screenshots and update README/audit.

Deliverable: verified release candidate.

**Gate:** all required workflows and quality gates pass.

---

## 10. Feature decision register

Resolve these before implementation:

| Decision | Current evidence | Recommendation |
|---|---|---|
| Product images | Not in Activity 3/4 Product fields or current schema | Useful optional enhancement; approve schema update |
| Image carousel | No product image collection | Start with one primary image unless gallery has a real need |
| Product categories | Not in Activity 3/4 Product fields or current schema | Optional; approve data model |
| Seller role | Activity 3 says customers and store administrators; Activity 4 describes customer/admin accounts | Keep customer/admin unless another approved source explicitly requires Seller |
| Water saved | Activity 3/4 and current schema list paper and carbon only | Do not implement until exact requirement/formula is provided |
| SKU/barcode | No field in current Product schema | Optional POS enhancement |
| Stock adjustment log | No adjustment-history entity in current ERD | Optional schema expansion |
| Low-stock threshold | Status exists; configurable threshold not established | Define global/per-product rule before changing |
| Product archive | Not established in current Product schema | Optional; useful to preserve historical records |
| Admin transaction search/export | Verify current views before adding another page | Add only if existing ledger/receipt lookup is insufficient |

---

## 11. Out of scope unless separately approved

Do not add these merely to make the application appear more feature-rich:
- External payment gateway integration.
- Promotions, coupons and discount campaigns.
- Supplier and purchase-order management.
- Multi-store/multi-tenant management.
- Blog/CMS.
- Chat or real-time notifications.
- Loyalty points and rewards.
- Product reviews/ratings.
- Water-saved calculations without an approved formula.
- Seller role without an approved role/permission requirement.

These features increase schema, testing, security and documentation burden and may distract from the academic requirements.

---

## 12. Definition of done

For every phase:
- [ ] Scope is mapped to an approved project requirement or explicitly approved enhancement.
- [ ] Existing behavior is preserved unless change is intentional and documented.
- [ ] Schema change (if any) includes updated ERD, SQL and migration.
- [ ] Unit/API tests pass.
- [ ] Browser tests cover changed workflows.
- [ ] Mobile viewport at 375×667 is checked.
- [ ] Desktop viewport at 1440×900 is checked.
- [ ] Accessibility is checked for changed screens.
- [ ] Production build passes.
- [ ] README and audit status are updated.
- [ ] Changed files, test commands, results and known limitations are reported.

---

## 13. Reusable AI implementation prompt

> You are modifying the existing GreenCart repository. Start by inspecting the latest `main` branch and commit, then inspect the relevant source files, SQL schema, migrations, tests, project activities and the current audit. This roadmap may be stale relative to the repository; verify every claimed gap before editing.
>
> Implement only the phase specified by the user. Preserve the seven-entity ERD, customer/admin role model, API contracts and transaction behavior unless the user provides explicit approval for a scope/schema change. Activity 3 and Activity 4 currently document customer/admin accounts and paper/carbon Eco-Impact; do not invent a Seller role or water-saved formula.
>
> Use Impeccable for UX critique/design, Taste frontend engineering for React implementation, Playwright for browser verification, Axe for accessibility tests, Caveman for evidence-based bug investigation/review, and Ponytail for behavior-preserving simplification where appropriate.
>
> Do not replace working functionality with static mockups. Do not add dead controls, mock data presented as real data, or unsupported features. For every schema change, update the ERD, SQL schema, migration, seed data, types, APIs, UI and tests as needed.
>
> Run the relevant unit/API tests, browser tests and production build. Report changed files, implementation details, schema/API changes, test commands/results, unresolved decisions, and a manual test checklist. Complete only this phase and stop for review.

---

## 14. Final recommendation

The updated GreenCart already completes much of the earlier responsive UX and security backlog. Do not spend another phase rebuilding role shells, cart persistence, receipt printing, session expiry or basic Playwright setup.

The highest-value next steps are:

1. Clean up stale documentation and establish a single accurate roadmap.
2. Approve and implement product images and categories if the group wants a richer catalog.
3. Consider SKU/barcode lookup for faster POS.
4. Improve inventory accountability only where the business case justifies schema changes.
5. Resolve the Seller-role and water-saved claims against the actual approved proposal before implementing either.
6. Expand browser tests to failure cases and every major screen.

**GreenCart becomes a stronger project by completing useful, traceable functionality—not by adding features that the proposal, data model, or team cannot properly support.**
