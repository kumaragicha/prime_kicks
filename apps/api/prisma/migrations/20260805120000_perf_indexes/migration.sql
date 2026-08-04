-- Performance indexes backing the list/sort/filter queries.

-- User: admin list is `where deletedAt IS NULL order by createdAt desc`.
DROP INDEX IF EXISTS "User_deletedAt_idx";
CREATE INDEX "User_deletedAt_createdAt_idx" ON "User"("deletedAt", "createdAt");

-- Product: storefront/admin catalog is `where deletedAt IS NULL order by createdAt desc`.
DROP INDEX IF EXISTS "Product_deletedAt_idx";
CREATE INDEX "Product_deletedAt_createdAt_idx" ON "Product"("deletedAt", "createdAt");

-- Order: "my orders" / per-user receivables (userId + createdAt sort).
DROP INDEX IF EXISTS "Order_userId_idx";
CREATE INDEX "Order_userId_createdAt_idx" ON "Order"("userId", "createdAt");

-- Order: admin list filtered by status + sorted by date, and the
-- APPROVED_PAYMENT_PENDING receivables rollup (groupBy userId where status).
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");
