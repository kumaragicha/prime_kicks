-- Monetary values are stored directly in whole Indian rupees.
ALTER TABLE "Product" RENAME COLUMN "inhouseCostCents" TO "inhouseCost";
ALTER TABLE "Product" RENAME COLUMN "resellerPriceCents" TO "resellerPrice";
ALTER TABLE "Product" RENAME COLUMN "customerPriceCents" TO "customerPrice";

ALTER TABLE "Order" RENAME COLUMN "subtotalCents" TO "subtotal";
ALTER TABLE "Order" RENAME COLUMN "shippingCents" TO "shipping";
ALTER TABLE "Order" RENAME COLUMN "totalCents" TO "total";
ALTER TABLE "OrderItem" RENAME COLUMN "unitPriceCents" TO "unitPrice";

-- Convert pre-existing paise values to whole rupees.
UPDATE "Product"
SET
  "inhouseCost" = ROUND("inhouseCost" / 100.0),
  "resellerPrice" = ROUND("resellerPrice" / 100.0),
  "customerPrice" = ROUND("customerPrice" / 100.0);

UPDATE "Order"
SET
  "subtotal" = ROUND("subtotal" / 100.0),
  "shipping" = ROUND("shipping" / 100.0),
  "total" = ROUND("total" / 100.0);

UPDATE "OrderItem" SET "unitPrice" = ROUND("unitPrice" / 100.0);
