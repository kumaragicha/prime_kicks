-- Add paymentStatus enum and column to Order table
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'RECEIVED');

ALTER TABLE "Order" ADD COLUMN "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING';