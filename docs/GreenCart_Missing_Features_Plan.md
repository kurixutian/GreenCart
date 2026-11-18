# GreenCart — Missing Features Implementation Plan

> **Status:** P0–P2 implemented on `main` (see [GreenCart_Updated_Feature_Gap_and_Enhancement_Roadmap.md](file:///home/kurixutian/projects/GreenCart/docs/GreenCart_Updated_Feature_Gap_and_Enhancement_Roadmap.md) for the canonical forward roadmap and optional Phase 1–5 schema proposals).  
> **Repository:** [kurixutian/GreenCart](https://github.com/kurixutian/GreenCart)  
> **Current stack:** React 19 + TypeScript + Vite + SQLite (server-side) + Playwright  
> **Source of truth for scope:** `Group4_Act.3 (1).md`, `Group4_Act.4 (1).md`, `GREENCART_UI_UX_AND_TECHNICAL_AUDIT.md`  
> **This plan covered the P0 → P2 gaps identified in the initial audit**, with optional schema changes (`OPT.1`, `OPT.2`, `ARCH.1`, `DATA.1`) separated.

---

## 0. Guiding Principles (Anti‑Hallucination Guardrails)

1. **No new tables unless a phase explicitly says "schema change."** The canonical ERD is 7 tables (`accounts`, `products`, `inventory`, `transactions`, `transaction_details`, `digital_receipts`, `eco_impact`). Optional scope changes (images, categories) require a migration and an ERD update **before** UI work.
2. **Every feature must map to a PDF line or an audit finding.** If it doesn't, it goes in the "Deferred / Out of Scope" section.
3. **Mobile‑first is P0.** Do not start P1 work until the P0 checklist passes on a 375px viewport.
4. **No external APIs for QR or eco‑impact** — QR uses a local library, eco‑impact uses arithmetic constants.
5. **Commit per sub‑phase** with the phase number in the message (e.g., `feat(P1.2): add cart count badge`).

---

## 1. Priority Matrix (from `GREENCART_UI_UX_AND_TECHNICAL_AUDIT.md`)

| ID | Feature | Priority | Type | Depends on |
|----|---------|----------|------|------------|
| P0.1 | Mobile‑first layouts (catalog, cart, POS, inventory) | **P0** | UX | — |
| P1.1 | Checkout confirmation + success states | P1 | UX | — |
| P1.2 | Visible cart count + add‑to‑cart toast | P1 | UX | — |
| P1.3 | Product sorting + detail modal/view | P1 | UX | Optional: images |
| P1.4 | Faster POS & inventory search/edit | P1 | UX/Perf | — |
| P1.5 | Enriched receipt content (QR, customer, date, line items) | P1 | UX | — |
| P2.1 | Session expiration | P2 | Security | — |
| P2.2 | Playwright browser‑level UI tests | P2 | Testing | P0–P1 done |
| OPT.1 | Product images (single + carousel) | Optional | Schema + UX | ERD update |
| OPT.2 | Product categories | Optional | Schema + UX | ERD update |
| ARCH.1 | Dedicated `seller` role | Architectural | Schema + Auth | ERD update |
| DATA.1 | "Water saved" eco‑metric | Data | Schema + UX | — |

---

## Phase P0 — Mobile‑First Usability (Critical)

**Goal:** The catalog, cart, POS register, and inventory table must be usable on a 375×667 viewport (iPhone SE) with touch targets ≥ 44px.

### P0.1 — Mobile Layout Overhaul

**Skills:** CSS Grid/Flexbox, `@media` queries, React conditional rendering, touch‑target sizing, `viewport` meta audit.

**Files touched:** `src/client/components/CatalogView.tsx`, `src/client/components/CustomerShell.tsx`, `src/client/components/PosView.tsx`, `src/client/components/InventoryView.tsx`, `src/client/index.css`.

**Tasks:**

1. **Audit every screen at 375px, 768px, 1024px, 1440px.** Screenshot each into `docs/mobile-audit/`.
2. **Catalog:** switch product grid to 2‑column on mobile, 3‑col tablet, 4‑col desktop. Cards must stack image → name → price → add‑button vertically.
3. **Cart:** convert side drawer to **bottom sheet** on `<768px`; keep side drawer on desktop. Ensure the checkout button is sticky and full‑width on mobile.
4. **POS register:** two‑column desktop layout (product search left, cart right) collapses to **single column with a sticky "View Cart" FAB** on mobile.
5. **Inventory table:** replace `<table>` with **card list** on mobile (`<dl>` or stacked `<div>` cards). Each card shows product name, stock, price, and an edit button.
6. **Touch targets:** every button/input ≥ 44×44px. Add `padding` and `min-height` where needed.
7. **Viewport meta:** confirm `<meta name="viewport" content="width=device-width, initial-scale=1">` in `index.html`.

**Acceptance criteria:**

- [x] No horizontal scroll at 375px on any page.
- [x] All interactive elements ≥ 44px.
- [x] POS sale can be completed end‑to‑end on a 375px viewport.
- [x] Inventory edit works on mobile without zooming.

**Anti‑hallucination check:** Do not introduce a new UI library. Use existing CSS/SCSS patterns.

---

## Phase P1 — Core UX Completion

### P1.1 — Checkout Confirmation & Success States

**Goal:** Prevent accidental orders and give clear feedback.

**Skills:** React state, form validation, toast/notification pattern, routing.

**Tasks:**

1. Add a **review step** before submission: order summary (items, quantities, subtotals, total) + "Confirm & Pay" button.
2. On submit, disable the button and show a **loading spinner** ("Processing…").
3. On success, redirect to `/receipt/:transactionId` and show a **success banner** ("Order confirmed — your digital receipt is ready").
4. On failure, show an **error toast** with retry action; keep cart intact.
5. Add **client‑side validation**: required name/email (if guest checkout), cart not empty.

**Acceptance criteria:**

- [x] Cannot submit an empty cart.
- [x] Double‑click on "Confirm" does not create two transactions (idempotency guard — disable + server‑side check).
- [x] Success page shows transaction ID and QR link.

---

### P1.2 — Cart Count & Add‑to‑Cart Feedback

**Skills:** React Context or Zustand (whichever is already used), toast pattern, animation.

**Tasks:**

1. Show a **cart badge** with item count in the navbar (updates live).
2. On "Add to cart", show a **toast** ("Added <product> to cart") for ~2s, with a "View cart" link.
3. Animate the badge (scale pulse) on increment — keep it subtle.
4. Ensure the cart state is persisted (localStorage or server session) so refresh doesn't lose it.

**Acceptance criteria:**

- [x] Badge count matches cart items after add/remove/quantity change.
- [x] Toast appears once per add, not on page load.
- [x] Cart survives a page refresh.

---

### P1.3 — Product Sorting & Detail View

**Skills:** SQL `ORDER BY`, URL query params or client‑side sort, modal component.

**Tasks:**

1. **Sorting:** dropdown with "Name A–Z", "Name Z–A", "Price low→high", "Price high→low". Persist in URL (`?sort=price_asc`) so it's shareable.
2. **Search:** keep existing search; add a **clear (×) button** and debounce input (300ms).
3. **Detail view:** clicking a product card opens a **modal** (or `/product/:id` route) showing name, description, price, stock status, and (if OPT.1 done) image + carousel. "Add to cart" from the modal.
4. **Stock indicator:** show "In stock", "Low stock (N left)", or "Out of stock" — pulled from `inventory`.

**Acceptance criteria:**

- [x] Sorting works combined with search and stock filter (category filter awaits OPT.2).
- [x] Out‑of‑stock products cannot be added to cart.
- [x] Modal is keyboard‑accessible (Esc to close).

---

### P1.4 — Faster POS & Inventory Search/Edit

**Skills:** Debounced search, SQL indexes, optimistic UI, keyboard shortcuts.

**Tasks:**

1. **Indexes:** add `CREATE INDEX idx_products_name ON products(product_name);` and `CREATE INDEX idx_products_category ON products(category_id);` (if OPT.2) in `db/schema.sql`.
2. **POS product search:** debounce 200ms, support **barcode/SKU** field if products have one (else name search), highlight matching text.
3. **POS keyboard shortcuts:** `F2` focus search, `Enter` add top result, `F4` open cart, `Esc` clear.
4. **Inventory inline edit:** click a cell to edit price/stock; save on `Enter` or blur; show saving state; optimistic update with rollback on error.
5. **Stock alerts:** rows with `quantity_on_hand <= reorder_level` get a red badge "Low stock" and are sorted to the top of the inventory view by default.

**Acceptance criteria:**

- [x] Search returns results in < 200ms locally.
- [x] Inline edit persists to DB and reflects in catalog.
- [x] Low‑stock products are visually obvious without hovering.

---

### P1.5 — Enriched Digital Receipt

**Skills:** SQL JOIN (`transactions` + `transaction_detail` + `products` + `accounts`), JSON parsing, QR rendering.

**Tasks:**

1. `ReceiptView` must display:
   - **QR code** (large, scannable) generated from the `qr_token`.
   - **Customer name** (from `accounts` or guest name).
   - **Transaction number** and **date/time**.
   - **Line items** table: product name, qty, unit price, subtotal.
   - **Grand total**.
   - **Eco‑impact summary** for this receipt: paper sheets saved, CO₂ reduced, water saved (if DATA.1 done).
2. Add a **"Print / Save as PDF"** button using `window.print()` with a print‑specific stylesheet (`@media print`).
3. Receipt URL must be shareable via token (`/receipt/view?token=...`) and must **not expose the internal numeric transaction ID** in the URL.

**Acceptance criteria:**

- [x] Scanning the QR opens the receipt view with all fields populated.
- [x] Print preview hides nav/footer and shows only the receipt.
- [x] Invalid token shows a friendly error notification without disclosing other receipts.

---

## Phase P2 — Security & Testing

### P2.1 — Session Expiration

**Skills:** Express/Node session middleware (or whatever backend is used), cookie flags, client‑side idle detection.

**Tasks:**

1. **Server‑side:** set session cookie with `httpOnly`, `secure` (in prod), `sameSite=lax`, and a **rolling expiry** (e.g., 30 min idle).
2. **Client‑side:** after 25 min of no interaction, show a **"Your session will expire in 5 minutes"** modal with "Stay logged in" / "Log out".
3. On expiry, redirect to login with a message.
4. Admin/POS routes must check role **on every request**, not just at login.

**Acceptance criteria:**

- [x] Idle for 30 min → session invalidated server‑side.
- [x] "Stay logged in" refreshes the session.
- [x] Protected API returns 401 after expiry.

---

### P2.2 — Playwright Browser‑Level UI Tests

**Skills:** Playwright, `@playwright/test`, page objects, CI integration.

**Tasks (minimum suite):**

1. **Customer happy path:** browse → add to cart → checkout → confirmation → view receipt (QR present).
2. **Mobile happy path:** same flow at 375px viewport.
3. **Auth:** login as customer, login as admin, logout, expired session redirect.
4. **POS:** admin processes a sale → stock decrements → receipt generated.
5. **Inventory:** edit price/stock → reflected in catalog.
6. **Eco‑impact:** after N transactions, dashboard totals equal sum of `eco_impact` rows.

**Acceptance criteria:**

- [x] `npx playwright test` passes locally.
- [x] Tests run in CI (GitHub Actions) on push.
- [x] No flaky tests — deterministic seeds + non-destructive checks.

---

## Phase OPT — Optional Scope Changes (Require ERD Update)

> ⚠️ These change the canonical 7‑table schema. **Update the ERD and get sign‑off before coding.**

### OPT.1 — Product Images (Single + Carousel)

**Schema change:**
```sql
-- Option A: single image
ALTER TABLE products ADD COLUMN image_url TEXT;

-- Option B: multiple images (recommended for carousel)
CREATE TABLE product_images (
  image_id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  alt_text TEXT
);
CREATE INDEX idx_product_images_product ON product_images(product_id, sort_order);
```

**Skills:** File upload (multipart), image storage strategy (local `uploads/` or base64 for demo — **local files preferred**), carousel component (build with CSS scroll‑snap or use a lightweight lib like `embla-carousel` — **do not add a heavy dependency without approval**), alt text for a11y.

**Tasks:**
1. Admin upload form: accepts JPG/PNG/WebP ≤ 2MB; validate MIME server‑side.
2. Store files in `public/uploads/products/<uuid>.<ext>`; store relative URL in DB.
3. Product detail modal shows a **carousel** with prev/next + dots; first image is the catalog thumbnail.
4. Fallback placeholder image when `product_images` is empty.

**Acceptance criteria:**
- [ ] Upload → image appears in catalog and detail carousel.
- [ ] Carousel is swipeable on mobile and keyboard‑navigable.
- [ ] Deleting a product cascades image rows and deletes files.

---

### OPT.2 — Product Categories

**Schema change:**
```sql
CREATE TABLE categories (
  category_id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE
);
ALTER TABLE products ADD COLUMN category_id INTEGER REFERENCES categories(category_id) ON DELETE SET NULL;
CREATE INDEX idx_products_category ON products(category_id);
```

**Skills:** CRUD, filter UI, URL params.

**Tasks:**
1. Admin CRUD for categories (name + slug auto‑generated).
2. Product form gets a category `<select>`.
3. Catalog sidebar/dropdown filter by category; combine with search + sort.
4. Category filter persists in URL (`?category=snacks`).

**Acceptance criteria:**
- [ ] Filter + search + sort compose correctly.
- [ ] Uncategorised products appear under "All".

---

### ARCH.1 — Dedicated `seller` Role

**Schema change:** change `accounts.role` CHECK to include `'seller'`.

**Tasks:**
1. Role‑based route guards: `seller` can access POS + inventory read; `admin` can access everything (including user management).
2. Update seed data with a `seller` account.
3. Update auth middleware to return role in session.
4. Add tests for each role's allowed routes.

**Acceptance criteria:**
- [ ] Seller cannot access admin‑only user management.
- [ ] Seller can process sales and edit inventory.
- [ ] Admin sees all seller actions.

---

### DATA.1 — "Water Saved" Eco‑Metric

**Schema change:**
```sql
ALTER TABLE eco_impact ADD COLUMN water_saved_liters REAL DEFAULT 0;
```

**Skills:** SQL migration, arithmetic constants, Chart.js update.

**Tasks:**
1. On sale completion, calculate `water_saved_liters = paper_sheets × WATER_PER_SHEET` (constant, e.g., `5.0` L/sheet — document the source in a comment).
2. Update Eco‑Impact Dashboard to show **3 KPI cards**: Paper Saved (sheets), CO₂ Reduced (kg), Water Saved (L).
3. Add a **bar chart** comparing the three metrics over time (monthly).
4. Update the enriched receipt (P1.5) to include water saved.

**Acceptance criteria:**
- [ ] Dashboard totals equal `SUM()` of `eco_impact` columns.
- [ ] Constants are defined in one place (`src/config/eco.ts`) with a comment explaining the source/assumption.

---

## 2. Suggested Execution Order & Timeline

| Week | Focus | Phases | Checkpoint |
|------|-------|--------|------------|
| 1 | Mobile P0 | P0.1 | 375px audit passes |
| 2 | Checkout + cart UX | P1.1, P1.2 | Happy path demo |
| 3 | Discovery + POS/inventory | P1.3, P1.4 | Seller demo |
| 4 | Receipt + security | P1.5, P2.1 | Receipt scan works |
| 5 | Tests | P2.2 | CI green |
| 6 (optional) | Images + categories | OPT.1, OPT.2 | ERD v2 signed off |
| 7 (optional) | Seller role + water metric | ARCH.1, DATA.1 | Full audit re‑run |

---

## 3. Definition of Done (per phase)

- [ ] Code merged to `main` via PR.
- [ ] Acceptance criteria checked off in the PR description.
- [ ] Manual mobile test at 375px and desktop test at 1440px.
- [ ] No new TypeScript errors (`tsc --noEmit` clean).
- [ ] Lint passes (`eslint .`).
- [ ] If schema changed: `db/schema.sql` updated **and** an `db/migrations/<timestamp>_<name>.sql` file added.
- [ ] If UI changed: screenshot added to `docs/screenshots/`.
- [ ] `GREENCART_UI_UX_AND_TECHNICAL_AUDIT.md` updated to mark the item resolved.

---

## 4. What Stays Out of Scope (Do Not Build)

To prevent scope creep and hallucinated features, the following are **explicitly excluded**:

- **Promos / discounts** (user said exclude from CheoreoBiz inspiration).
- **Suppliers / purchase orders** (excluded by user).
- **Blog CMS** (Ogani's blog page stays static or repurposed for Eco‑Impact info).
- **External payment gateways** (cash‑on‑delivery / simulated payment only, per the PDFs).
- **Real‑time chat / notifications** (not in the PDFs).
- **Multi‑tenant / multi‑store** (single storefront only).
- **Third‑party eco‑impact APIs** (use local constants).

---

## 5. Anti‑Hallucination Verification Checklist (Run Before Every PR)

1. Does this feature trace to a line in `Group4_Act.1.pdf` or `Group4_Act.3.pdf`, **or** an item in the audit?
2. Did I add a new table/column without updating the ERD and `db/migrations/`? → **Stop and fix.**
3. Did I introduce a new dependency? → **Justify it in the PR and check bundle size.**
4. Did I hardcode a value that should be a constant/config? → **Move it to `src/config/`.**
5. Did I test at 375px? → **Required for any UI change.**
6. Did I expose internal IDs in URLs where a token should be used? → **Use `qr_token` for receipts.**
7. Are all SQL queries parameterised? → **No string concatenation.**

---

> **Start with P0.1.** P0–P2 are now complete; see [GreenCart_Updated_Feature_Gap_and_Enhancement_Roadmap.md](file:///home/kurixutian/projects/GreenCart/docs/GreenCart_Updated_Feature_Gap_and_Enhancement_Roadmap.md) for the current canonical forward roadmap.