-- GreenCart Seed Data (Accounts use salted scrypt password hashes)
PRAGMA foreign_keys = ON;

INSERT INTO accounts (account_id, username, password_hash, account_type, full_name) VALUES
  (1, 'maria_santos', 'scrypt$a83448db2a939986f86fafc68c21b74d$ffa91e4b4ee2646b09e2c99689646528cce9b5189c3a1caa23471754b3dd9d5f', 'customer', 'Maria Santos'),
  (2, 'juan_delacruz', 'scrypt$7306cf93836e65583a871b684aa0b835$021e0cfc07568bfa8f2b9413770a968c5a9fb3165fc43417545fa264d14f507a', 'customer', 'Juan Dela Cruz'),
  (3, 'walkin_customer', 'scrypt$781bf054c67850809758e37de82a817e$cd348c7ddfabe5429feb71d55cfa57c55c3d00a7acbb517d097206cdac571601', 'customer', 'Walk-In Customer (POS)'),
  (4, 'admin_qcu', 'scrypt$f36a7e1a588a7d087ddd40bc24dade82$39400ef6899945d06e9cb5db241aa9a03fa49378b24291748305d7b27cd1e271', 'admin', 'Store Administrator');

INSERT INTO products (product_id, product_name, description, price) VALUES
  (1, 'Bamboo Toothbrush 4-Pack', 'Biodegradable Moso bamboo handles with charcoal-infused soft bristles.', 145.00),
  (2, 'Organic Canvas Market Tote', 'Heavy-duty unbleached cotton shopping bag with reinforced stitched handles.', 220.00),
  (3, 'Insulated Stainless Tumbler 500ml', 'Double-wall vacuum flask that keeps drinks cold for 24 hours without single-use cups.', 480.00),
  (4, 'Beeswax Reusable Food Wraps (Set of 3)', 'Washable organic cotton wraps coated in local beeswax and tree resin.', 290.00),
  (5, 'Refillable Amber Glass Soap Dispenser', '500ml UV-protected glass pump bottle designed for zero-waste refill stations.', 195.00),
  (6, 'Recycled Kraft Spiral Notebook', 'A5 dotted journal crafted from 100% post-consumer recycled paper.', 110.00),
  (7, 'Natural Loofah Dish Scrubbers (3 pcs)', 'Compostable plant-fiber kitchen sponges that replace synthetic microplastic pads.', 95.00),
  (8, 'Bamboo Utensil Travel Roll', 'Reusable fork, spoon, knife, chopsticks, and cleaning brush in a linen pouch.', 175.00);

INSERT INTO inventory (inventory_id, product_id, quantity, stock_status) VALUES
  (1, 1, 34, 'In Stock'),
  (2, 2, 18, 'In Stock'),
  (3, 3, 8, 'Low Stock'),
  (4, 4, 22, 'In Stock'),
  (5, 5, 6, 'Low Stock'),
  (6, 6, 45, 'In Stock'),
  (7, 7, 0, 'Out of Stock'),
  (8, 8, 27, 'In Stock');

INSERT INTO transactions (transaction_id, account_id, transaction_date, total_amount) VALUES
  (1001, 1, '2026-11-12 10:24:00', 365.00),
  (1002, 1, '2026-11-16 15:42:00', 590.00),
  (1003, 2, '2026-11-17 11:08:00', 465.00);

INSERT INTO transaction_details (detail_id, transaction_id, product_id, quantity, subtotal) VALUES
  (1, 1001, 1, 1, 145.00),
  (2, 1001, 2, 1, 220.00),
  (3, 1002, 3, 1, 480.00),
  (4, 1002, 6, 1, 110.00),
  (5, 1003, 4, 1, 290.00),
  (6, 1003, 8, 1, 175.00);

INSERT INTO digital_receipts (receipt_id, transaction_id, qr_code, receipt_date) VALUES
  (501, 1001, 'GC-A491C82E10F4', '2026-11-12 10:24:00'),
  (502, 1002, 'GC-7D30B59E42A1', '2026-11-16 15:42:00'),
  (503, 1003, 'GC-9F28E14C66B9', '2026-11-17 11:08:00');

INSERT INTO eco_impact (impact_id, transaction_id, paper_saved, carbon_reduction) VALUES
  (801, 1001, 1.50, 5.25),
  (802, 1002, 1.50, 5.25),
  (803, 1003, 1.50, 5.25);
