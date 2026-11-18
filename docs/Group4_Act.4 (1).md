ACTIVITY 4 - ERD DESIGN

INSTRUCTIONS:

Create a comprehensive entity relationship diagram (ERD) for your design project
proposal.  The  diagram  should  clearly  illustrate  entities,  attributes,  relationships,  and
cardinalities. Additionally, provide a concise explanation of the ERD, highlighting its role
in modeling the data structure and supporting the overall system design.

GreenCart: An Eco-Friendly Shopping Application with Paperless Receipts

WHAT IS ERD ALL ABOUT?

The  Entity-Relationship  Diagram  (ERD) shows how GreenCart organizes and connects
its  data  in  a  relational  database.  It  represents  the  main  entities  involved  in  the  shopping
process, such as accounts, products, inventory, transactions, transaction details, digital receipts,
and eco-impact records.

In simple terms, the ERD follows the flow:
Customer  Account  →  Transaction  →  Purchased  Products  →  Digital  Receipt  →
Eco-Impact

This  enables  GreenCart  to  effectively  link a customer's purchases to the products they
have  bought,  their  corresponding  paperless  receipts,  and the environmental impact generated
by  each  transaction.  It  provides  an  organized  way  to  track  purchase  records,  access  digital
receipts,  and monitor the estimated paper savings and carbon reduction associated with every
purchase.

Submitted by: 1.1 Accad, 1.5 Belmonte, 2.6 Daliwan, 3.2 Garcia, 3.3 Gaspar, 4.1
Lim, 4.2 Manzon, 4.3 Marcial, 4.4 Mariano, 4.5 Moyalde
Date Submitted: WK 5 – 09/11/26
Submitted to: Mr. Benjamin D. Molinar                                      Score :

ENTITIES AND ARCHITECTURE

The ERD of GreenCart consists of seven main entities that represent the different types
of data managed by the system. These entities are connected through primary and foreign keys
to ensure that information is properly organized and related.

●  Account  –  stores  customer  and  administrator  account  information,  including  the

username, password, and account type.

●  Product  –  stores  information  about  the  products  available  in  the  system,  such  as  the

product name, description, and price.
Inventory – manages the available quantity and stock status of each product.

●
●  Transaction – records completed purchases and identifies the account associated with

each transaction.

●  Transaction  Detail  –  records  the  specific  products  included in a transaction, including

their quantity and subtotal.

●  Digital  Receipt  –  stores  the  digital  receipt information and QR code associated with a

transaction.

●  Eco-Impact  –  stores  the  environmental  impact  information  of  a  transaction,  including

paper saved and carbon reduction.

The  architecture  represented  by the ERD follows a relational database structure where
these  entities  are  connected  to  allow  data  to  flow  throughout  the  GreenCart  system.  The
Account  is  connected  to  Transaction,  which  is  connected  to  Transaction  Detail  and  Product.
Transactions  are  also  connected  to  Digital  Receipt  and  Eco-Impact,  while Inventory manages
the stock information of the products. Primary Keys (PK) uniquely identify records, while Foreign
Keys (FK) establish the relationships between related entities.

CARDINALITIES AND BUSINESS RULES

●  The  ERD  uses  ||  to  represent  exactly  one,  o<  to  represent  zero-to-many,  and  o|  to
represent  zero-to-one.  These  symbols  describe  the  number  of  records  that  can  be
associated between entities. For instance, ACCOUNT ||--o< TRANSACTION means that
one  account  can  have  zero or several transactions, while every transaction is linked to
exactly one account.

●  PRODUCT ||--|| INVENTORY shows a one-to-one relationship between a product and its
inventory record. Meanwhile, PRODUCT ||--o< TRANSACTION_DETAIL indicates that a
product  may  be  included  in  zero  or  multiple  transaction  details, while each transaction
detail is connected to one specific product.

●  TRANSACTION ||--< TRANSACTION_DETAIL represents a one-to-many relationship. A
single transaction can contain multiple transaction details, with each detail identifying the
product  purchased,  its  quantity,  and  its  subtotal.  Each  transaction  detail  is  associated
with only one transaction.

●  TRANSACTION  ||--||  DIGITAL_RECEIPT  and  TRANSACTION  ||--||  ECO_IMPACT
represent  one-to-one  relationships.  Each transaction is associated with a digital receipt
and  a  corresponding  Eco-Impact  record,  which  stores  information  about  the estimated
paper saved and carbon reduction from the transaction.

Submitted by: 1.1 Accad, 1.5 Belmonte, 2.6 Daliwan, 3.2 Garcia, 3.3 Gaspar, 4.1
Lim, 4.2 Manzon, 4.3 Marcial, 4.4 Mariano, 4.5 Moyalde
Date Submitted: WK 5 – 09/11/26
Submitted to: Mr. Benjamin D. Molinar                                      Score :

---

## ERD v2 Amendment (Approved Phase 1–3 Product & Inventory Accountability Expansion)

Preserves the canonical seven entities (`Account`, `Product`, `Inventory`, `Transaction`, `Transaction_Detail`, `Digital_Receipt`, `Eco_Impact`) and extends `Product`, `Inventory`, and audit history via `db/migrations/001_phase1_product_images_and_categories.sql`, `db/migrations/002_phase2_product_sku.sql`, and `db/migrations/003_phase3_inventory_accountability.sql`:
- `products.category` (`TEXT NOT NULL DEFAULT 'Kitchen & Home'`, indexed via `idx_products_category`)
- `products.image_url` (`TEXT`, nullable relative asset/upload path or HTTP(S) URL with client fallback)
- `products.sku` (`TEXT`, nullable unique SKU/barcode identifier indexed via `idx_products_sku`)
- `products.is_archived` (`INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1))`, indexed via `idx_products_archived`; hides inactive products from shopping/POS while preserving historical `transaction_details` and `digital_receipts`)
- `inventory.reorder_level` (`INTEGER NOT NULL DEFAULT 10 CHECK (reorder_level >= 1)`, configurable per-product low-stock threshold)
- `inventory_adjustments` audit entity (`adjustment_id`, `product_id` FK, `account_id` FK actor, `delta`, `previous_qty`, `new_qty`, `reason`, `adjusted_at`, indexed via `idx_inventory_adjustments_product_date`)

### Eco-Impact Specification & Methodology Decision (Phase 5)

Audited against `Group4_Act.3 (1).md`, `Group4_Act.4 (1).md`, and `Group4_Wireframe.md`:
- **Approved Implemented Metrics:**
  - `paper_saved` (`NUMERIC`, unit: `sheets`, **Estimate**): `1.00 + 0.25 * distinct_line_items` (base receipt header/footer sheet + per-item line estimate).
  - `carbon_reduction` (`NUMERIC`, unit: `g CO2e`, **Estimate**): `paper_saved * 3.50` (estimated thermal paper lifecycle factor per sheet avoided).
  - `paperless_count` (derived integer count from `digital_receipts`, factual transaction count).
- **Deferred / Pending Approval Metric (`water_saved`):** Neither Activity 3, Activity 4, nor the Wireframe establishes a `water_saved` field, unit, or conversion factor. Therefore, `eco_impact` strictly retains `paper_saved` and `carbon_reduction`; `water_saved` stays excluded unless formally approved by the group/adviser with a documented source formula.


