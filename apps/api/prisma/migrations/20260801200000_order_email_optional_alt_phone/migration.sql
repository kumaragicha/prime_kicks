-- AlterTable
-- Make email optional (nullable)
ALTER TABLE "Order" ALTER COLUMN "addressEmail" DROP NOT NULL;

-- Add alternative mobile number column (nullable)
ALTER TABLE "Order" ADD COLUMN "addressAltMobileNo" TEXT;
