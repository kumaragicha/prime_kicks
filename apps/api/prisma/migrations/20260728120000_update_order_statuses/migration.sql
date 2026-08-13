-- Update OrderStatus enum values
-- First, update any existing PAID, SHIPPED, DELIVERED, CANCELLED, REFUNDED to appropriate new statuses
UPDATE "Order" 
SET 
  status = CASE 
    WHEN status IN ('PAID', 'SHIPPED', 'DELIVERED') THEN 'APPROVED_PAYMENT_RECEIVED'
    WHEN status = 'CANCELLED' THEN 'REJECTED'
    WHEN status = 'REFUNDED' THEN 'APPROVED_PAYMENT_RECEIVED'
    ELSE status
  END
WHERE status IN ('PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED');

-- Update the enum type
ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";

CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'APPROVED_PAYMENT_RECEIVED', 'APPROVED_PAYMENT_PENDING', 'REJECTED');

-- Update the column to use the new enum type
ALTER TABLE "Order" 
ALTER COLUMN status TYPE "OrderStatus" 
USING status::text::"OrderStatus";

-- Drop the old enum type
DROP TYPE "OrderStatus_old";