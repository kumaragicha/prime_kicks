-- Add address columns to Order table
ALTER TABLE "Order" ADD COLUMN "addressName"     TEXT NOT NULL DEFAULT '';
ALTER TABLE "Order" ADD COLUMN "addressEmail"    TEXT NOT NULL DEFAULT '';
ALTER TABLE "Order" ADD COLUMN "addressMobileNo" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Order" ADD COLUMN "addressLine1"    TEXT NOT NULL DEFAULT '';
ALTER TABLE "Order" ADD COLUMN "addressLine2"    TEXT NOT NULL DEFAULT '';
ALTER TABLE "Order" ADD COLUMN "landmark"        TEXT NOT NULL DEFAULT '';
ALTER TABLE "Order" ADD COLUMN "pincode"         TEXT NOT NULL DEFAULT '';
ALTER TABLE "Order" ADD COLUMN "city"            TEXT NOT NULL DEFAULT '';
ALTER TABLE "Order" ADD COLUMN "state"           TEXT NOT NULL DEFAULT '';