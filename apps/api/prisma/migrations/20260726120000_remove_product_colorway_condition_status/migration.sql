-- Remove retired product metadata fields and their PostgreSQL enum types.
DROP INDEX IF EXISTS "Product_status_idx";
ALTER TABLE "Product"
  DROP COLUMN "colorway",
  DROP COLUMN "condition",
  DROP COLUMN "status";
DROP TYPE "ProductCondition";
DROP TYPE "ProductStatus";
