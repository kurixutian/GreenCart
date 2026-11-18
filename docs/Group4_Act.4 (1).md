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

