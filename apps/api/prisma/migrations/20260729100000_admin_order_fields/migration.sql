-- Add OrderType enum and admin order fields to Order table
CREATE TYPE "OrderType" AS ENUM ('BULK', 'SINGLE');

ALTER TABLE "Order" ADD COLUMN "orderType" "OrderType" NOT NULL DEFAULT 'SINGLE';
ALTER TABLE "Order" ADD COLUMN "shippingStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING';
