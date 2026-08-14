-- Add optional style/model name for grouping colorways in the catalog.
ALTER TABLE "Product" ADD COLUMN "model" TEXT;

-- Index backing (brand + model) grouping.
CREATE INDEX "Product_brandId_model_idx" ON "Product"("brandId", "model");
