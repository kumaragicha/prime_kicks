-- CreateEnum
CREATE TYPE "AuditModule" AS ENUM (
  'PRODUCTS',
  'ORDERS',
  'USERS',
  'CART',
  'SIZE_TYPES',
  'SIZES',
  'BRANDS',
  'CATEGORIES',
  'PRODUCT_TYPES',
  'AUTH'
);

-- CreateEnum
CREATE TYPE "AuditEvent" AS ENUM ('CREATION', 'UPDATION', 'DELETION');

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "referenceNumber" TEXT,
    "module" "AuditModule" NOT NULL,
    "moduleId" TEXT,
    "subModule" TEXT,
    "event" "AuditEvent" NOT NULL,
    "action" TEXT NOT NULL,
    "formData" JSONB,
    "auditedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_module_moduleId_idx" ON "AuditLog"("module", "moduleId");

-- CreateIndex
CREATE INDEX "AuditLog_event_idx" ON "AuditLog"("event");

-- CreateIndex
CREATE INDEX "AuditLog_auditedBy_idx" ON "AuditLog"("auditedBy");

-- CreateIndex
CREATE INDEX "AuditLog_referenceNumber_idx" ON "AuditLog"("referenceNumber");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
