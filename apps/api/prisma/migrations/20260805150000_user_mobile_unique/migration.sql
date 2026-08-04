-- Enforce one account per mobile number (same guarantee as email).
-- Any pre-existing duplicate mobile numbers must be resolved before this applies.
CREATE UNIQUE INDEX "User_mobileNo_key" ON "User"("mobileNo");
