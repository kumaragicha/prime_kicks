-- CreateTable
CREATE TABLE "PricingSetting" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "resellerShippingDeduction" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingSetting_pkey" PRIMARY KEY ("id")
);
