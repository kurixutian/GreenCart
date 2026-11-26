# GreenCart — Eco-Friendly Shopping & Paperless POS

Full-stack TypeScript + React + Tailwind CSS v4 + Node 24 (`node:sqlite`) web application implementing the canonical 7-entity GreenCart ERD.

## Quick Start (SQLite Default)

```bash
npm install
npm run dev
```

Open the printed local Vite URL in your browser.

### Presentation Setup with XAMPP / MySQL / phpMyAdmin
1. Start **Apache** and **MySQL** in **XAMPP Control Panel**.
2. Copy `.env.example` to `.env` (defaults to `DB_CLIENT=mysql`, `DB_HOST=127.0.0.1`, `DB_PORT=3306`, `DB_USER=root`, `DB_PASSWORD=`, `DB_NAME=greencart`).
3. Optional: import `db/schema.mysql.sql` and `db/seed.mysql.sql` in **phpMyAdmin** (`http://localhost/phpmyadmin`), or let GreenCart auto-create and seed the `greencart` database on startup.
4. Build and run the presentation server:
```bash
npm run build
npm start
```
All purchases, inventory changes, and audit logs will appear live inside phpMyAdmin under the `greencart` database.

### Demo Accounts
- **Customer:** `maria_santos` / `customer123`
- **Customer:** `juan_delacruz` / `customer123`
- **Admin (POS & Inventory):** `admin_qcu` / `admin123`

## Verification Gates

```bash
npm test
npm run build
```

## Architecture & MCP
- **Database:** `db/schema.sql`, `db/seed.sql`, `src/server/db.ts` (`data/greencart.sqlite`)
- **Business Logic & API:** `src/server/service.ts`, `src/server/apiPlugin.ts`
- **Client UI:** `src/client/*` with React 19, Tailwind CSS v4, inline SVG icons (`Icons.tsx`), and local `qrcode` generation
- **MCP Config (`.mcp.json`):** Configured for `filesystem`, `sqlite`, and `playwright` (`@playwright/mcp@latest`). Replace `/home/kurixutian/projects/GreenCart` with your own local repository path when cloning on another machine.
- **Browser & Accessibility QA:** `@playwright/test`, `@axe-core/playwright`, and `@lhci/cli` are installed in `devDependencies`.
- **GitHub Pages Demo Hosting:** Pushes to `main` trigger [`.github/workflows/pages.yml`](.github/workflows/pages.yml) (`VITE_BASE_PATH=/GreenCart/ VITE_STATIC_DEMO=true npm run build`), enabling a browser-local demo adapter (`src/client/demoStore.ts`) when the Node/SQLite backend is absent. In GitHub repo **Settings → Pages**, set **Source** to **GitHub Actions**.
