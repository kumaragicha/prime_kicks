-- Separate mobile (portrait) hero image, independent of the desktop (landscape)
-- imageUrl. Empty string means the storefront falls back to imageUrl.
ALTER TABLE "HeroSlide" ADD COLUMN "mobileImageUrl" TEXT NOT NULL DEFAULT '';
