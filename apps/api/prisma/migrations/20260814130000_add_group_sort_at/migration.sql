-- Denormalised group sort key for fast, index-backed catalog ordering.
ALTER TABLE "Product" ADD COLUMN "groupSortAt" TIMESTAMP(3);

-- Baseline: every product sorts by its own createdAt.
UPDATE "Product" SET "groupSortAt" = "createdAt";

-- Grouped products (same brand + model) share their group's newest createdAt.
UPDATE "Product" p SET "groupSortAt" = grp.mx
FROM (
  SELECT "brandId" AS bid, lower(trim("model")) AS m, MAX("createdAt") AS mx
  FROM "Product"
  WHERE "deletedAt" IS NULL AND "brandId" IS NOT NULL
    AND "model" IS NOT NULL AND trim("model") <> ''
  GROUP BY "brandId", lower(trim("model"))
) grp
WHERE p."deletedAt" IS NULL
  AND p."brandId" = grp.bid
  AND lower(trim(p."model")) = grp.m;

ALTER TABLE "Product" ALTER COLUMN "groupSortAt" SET NOT NULL;
ALTER TABLE "Product" ALTER COLUMN "groupSortAt" SET DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "Product_groupSortAt_idx" ON "Product"("groupSortAt");

-- Partial covering index for the storefront browse (deletedAt IS NULL), so the
-- common catalog page is an index-only ordered scan with LIMIT.
CREATE INDEX "Product_browse_idx"
  ON "Product"("groupSortAt" DESC, "brandId", "model", "createdAt" DESC, "id" DESC)
  WHERE "deletedAt" IS NULL;
