-- Users whose orders should push to Shipmozo but never auto-assign a courier
-- (push only). Complements the global autoAssignCourier toggle.
ALTER TABLE "ShipmozoSetting" ADD COLUMN "autoAssignSkipUserIds" TEXT[] NOT NULL DEFAULT '{}';
