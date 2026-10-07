-- Mobile number becomes the account identity.
--
-- Storefront signup now collects a name and a mobile number only, verified by a
-- WhatsApp OTP. Email, password, city and state are no longer collected there,
-- so they become nullable. Existing rows keep their values — ADMIN accounts in
-- particular still sign in with email + password.

ALTER TABLE "User" ALTER COLUMN "lastName" DROP NOT NULL;
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "User" ALTER COLUMN "city" DROP NOT NULL;
ALTER TABLE "User" ALTER COLUMN "state" DROP NOT NULL;
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- One live OTP per mobile number, used for both sign-up and login.
CREATE TABLE "MobileOtp" (
    "id" TEXT NOT NULL,
    "mobileNo" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastSentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MobileOtp_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MobileOtp_mobileNo_key" ON "MobileOtp"("mobileNo");
CREATE INDEX "MobileOtp_expiresAt_idx" ON "MobileOtp"("expiresAt");

-- Superseded by MobileOtp. Its rows are 10-minute pending signups, so nothing
-- durable is lost; anyone mid-signup simply starts again.
DROP TABLE IF EXISTS "PendingRegistration";
