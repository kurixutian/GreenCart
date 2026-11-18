ACTIVITY 3 – DBMS SYSTEM CONCEPTS AND ARCHITECTURE

GreenCart: An Eco-Friendly Shopping Application with Paperless Receipts,
the  DBMS  architecture  can  be  organized  into  a  clean  3-tier/layered  architecture.  The
proposal  specifically  requires  a  standardized  relational  database  for  transaction
integrity, data security, and connections between merchant sales records and customer
accounts.

DBMS ARCHITECTURE DIAGRAM

Submitted by: 1.1 Accad, 1.5 Belmonte, 2.6 Daliwan, 3.2 Garcia, 3.3 Gaspar, 4.1
Lim, 4.2 Manzon, 4.3 Marcial, 4.4 Mariano, 4.5 Moyalde
Date Submitted: WK 5 – 09/09/26
Submitted to: Mr. Benjamin D. Molinar                                      Score :

A. Presentation Layer

DESCRIPTION OF EACH LAYER

The Presentation Layer is the part of GreenCart that users directly interact with. It

provides interfaces for customers and store administrators.

It includes:

●  Customer Portal – allows customers to view digital receipts, purchase histories,

and product catalogs.

●  Admin/POS Dashboard – allows store managers to process sales and manage

products.

●  Product Catalog – displays available products.
●  Digital  Receipt/QR  View  –  allows  customers  to  access  paperless  receipts

through QR codes.

●  Eco-Impact Dashboard – displays estimated paper savings and carbon-footprint

reductions.

These  functions  are  based  on  the  project's  objectives  concerning  customer
accounts,  digital  receipts,  purchase  history,  product  catalogs,  POS,  inventory,  and
Eco-Impact analytics.

B. Application / Business Logic Layer

This layer acts as the middle layer between the user interface and the database.
It processes requests, applies system rules, validates information, and determines what
data should be stored or retrieved.

The major functions are:

●  User  &  Account  Management  –  manages  customer  and  authorized  user

accounts.

●  Product  &  Inventory  Management  –  manages  product  information  and  stock

levels.

●  Sales & Transaction Processing – records purchases and processes sales.
●  QR  &  Paperless  Receipt  Generation  –  creates  digital  receipts  and  connects

them to QR codes.

●  Purchase History – retrieves previous transactions associated with a customer.
●  Eco-Impact Analytics – calculates projected paper savings and carbon-footprint

reductions.

Submitted by: 1.1 Accad, 1.5 Belmonte, 2.6 Daliwan, 3.2 Garcia, 3.3 Gaspar, 4.1
Lim, 4.2 Manzon, 4.3 Marcial, 4.4 Mariano, 4.5 Moyalde
Date Submitted: WK 5 – 09/09/26
Submitted to: Mr. Benjamin D. Molinar                                      Score :

Authentication  &  Validation  –  verifies  users  and  helps  maintain  data  security  and
transaction integrity.

This  layer  supports  the  project's  goal  of  providing  a  standardized  relational
database  with  secure  and  reliable  connections  between  customer  accounts  and
merchant sales records.

C. Data / DBMS Layer

The  Data/DBMS  Layer  is  responsible  for  storing  and  managing  GreenCart's
information. A relational database management system (RDBMS) will be used because
the project requires a standardized relational database.

The DBMS will handle:

●  Data storage and retrieval
●  Relationships between tables
●  Transaction integrity
●  Data validation
●  Controlled database access
●  Security of customer and transaction information
●  Updating product and inventory records

This  supports  the  proposal's  requirement  for  transaction  integrity,  data  security,

and smooth connections between merchant sales records and customer accounts.

Submitted by: 1.1 Accad, 1.5 Belmonte, 2.6 Daliwan, 3.2 Garcia, 3.3 Gaspar, 4.1
Lim, 4.2 Manzon, 4.3 Marcial, 4.4 Mariano, 4.5 Moyalde
Date Submitted: WK 5 – 09/09/26
Submitted to: Mr. Benjamin D. Molinar                                      Score :

PROPOSED DATABASE SCHEMA

Table

Important Fields

Purpose

Account

Account_ID (PK), Username,
Password, Account_Type

Stores customer/admin account information

Product

Product_ID (PK), Product_Name,
Description, Price

Stores product catalog information

Inventory

Inventory_ID (PK), Product_ID (FK),
Quantity, Stock_Status

Tracks available product stock

Transaction

Transaction_ID (PK), Account_ID
(FK), Transaction_Date,
Total_Amount

Stores each completed purchase

Transaction_Detail

Detail_ID (PK), Transaction_ID (FK),
Product_ID (FK), Quantity, Subtotal

Stores individual products within a
transaction

Digital_Receipt

Receipt_ID (PK), Transaction_ID
(FK), QR_Code, Receipt_Date

Stores digital receipt information

Eco_Impact

Impact_ID (PK), Transaction_ID (FK),
Paper_Saved, Carbon_Reduction

Stores environmental impact calculations

Submitted by: 1.1 Accad, 1.5 Belmonte, 2.6 Daliwan, 3.2 Garcia, 3.3 Gaspar, 4.1
Lim, 4.2 Manzon, 4.3 Marcial, 4.4 Mariano, 4.5 Moyalde
Date Submitted: WK 5 – 09/09/26
Submitted to: Mr. Benjamin D. Molinar                                      Score :

The relationships allow GreenCart to connect customers → transactions →

purchased products → digital receipts → environmental impact data.

HOW DATA WILL BE STORED, MANAGED, AND ACCESSED

Data Storage

GreenCart will store information in related database tables rather than keeping all

information in one large table. Customer accounts will be stored in the Account table,
product information in Product, stock information in Inventory, and sales information in
Transaction and Transaction_Detail.

Digital receipts will be associated with their corresponding transactions through
the Digital_Receipt table. Environmental information such as estimated paper savings
and carbon reduction will be stored in Eco_Impact.

Submitted by: 1.1 Accad, 1.5 Belmonte, 2.6 Daliwan, 3.2 Garcia, 3.3 Gaspar, 4.1
Lim, 4.2 Manzon, 4.3 Marcial, 4.4 Mariano, 4.5 Moyalde
Date Submitted: WK 5 – 09/09/26
Submitted to: Mr. Benjamin D. Molinar                                      Score :

Data Management

The DBMS will maintain relationships using Primary Keys (PK) and Foreign Keys

(FK). For example, Account_ID connects an account to its transactions, while
Transaction_ID connects a transaction to its transaction details and digital receipt.

When a sale occurs, the system can update the inventory, create the transaction

record, generate the digital receipt, and record the corresponding Eco-Impact
information.

Data Access

Users will not directly access the database. Instead, requests will pass through

the Application/Business Logic Layer.
For Example:

This layered approach helps keep database operations controlled and makes the

system easier to maintain and secure.

Submitted by: 1.1 Accad, 1.5 Belmonte, 2.6 Daliwan, 3.2 Garcia, 3.3 Gaspar, 4.1
Lim, 4.2 Manzon, 4.3 Marcial, 4.4 Mariano, 4.5 Moyalde
Date Submitted: WK 5 – 09/09/26
Submitted to: Mr. Benjamin D. Molinar                                      Score :

DBMS ARCHITECTURE OVERVIEW

The  proposed  GreenCart  DBMS  uses  a  three-tier  architecture  consisting  of the
Presentation  Layer,  Application/Business  Logic  Layer,  and  Data/DBMS  Layer.  The
Presentation  Layer  provides  the  interfaces  for customers and administrators, including
the  customer  portal,  POS dashboard, digital receipts, product catalog, and Eco-Impact
dashboard.  The  Application  Layer  processes  user  requests  and  manages  functions
transactions,  QR  receipts,  purchase  history,  and
such  as  accounts,
environmental  analytics.  Finally,  the  Data/DBMS  Layer  stores  and  manages  the
application's relational data.

inventory,

The  database  is  organized  into  related  tables  such  as  Account,  Product,  Inventory,
Transaction,  Transaction_Detail,  Digital_Receipt, and Eco_Impact. Primary and foreign
keys  establish  relationships  among  these  tables,  allowing  customer  accounts  to  be
connected with sales records and digital receipts. This structure supports the proposal's
objective  of  maintaining  transaction  integrity,  data  security,  and  smooth  connections
between merchant sales records and customer accounts.

Submitted by: 1.1 Accad, 1.5 Belmonte, 2.6 Daliwan, 3.2 Garcia, 3.3 Gaspar, 4.1
Lim, 4.2 Manzon, 4.3 Marcial, 4.4 Mariano, 4.5 Moyalde
Date Submitted: WK 5 – 09/09/26
Submitted to: Mr. Benjamin D. Molinar                                      Score :

