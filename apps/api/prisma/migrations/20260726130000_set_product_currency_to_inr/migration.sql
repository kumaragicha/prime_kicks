-- Prices are always displayed in Indian rupees.
ALTER TABLE "Product" ALTER COLUMN "currency" SET DEFAULT 'INR';
UPDATE "Product" SET "currency" = 'INR' WHERE "currency" <> 'INR';

ALTER TABLE "Order" ALTER COLUMN "currency" SET DEFAULT 'INR';
UPDATE "Order" SET "currency" = 'INR' WHERE "currency" <> 'INR';
