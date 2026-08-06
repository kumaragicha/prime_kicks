import { Injectable } from '@nestjs/common';
import type { HeroUpdateSchema } from '@prime-kicks/validation';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HeroService {
  constructor(private readonly prisma: PrismaService) {}

  /** Active slides for the storefront, in display order. */
  publicSlides() {
    return this.prisma.heroSlide.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        imageUrl: true,
        title: true,
        subtitle: true,
        ctaLabel: true,
        ctaHref: true,
      },
    });
  }

  /** Every slide (admin editor), in display order. */
  allSlides() {
    return this.prisma.heroSlide.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  /**
   * Replace the whole carousel with the supplied ordered slides (max 4). Done in
   * a transaction so the homepage never reads a half-updated set. sortOrder is
   * derived from array position — the order the admin arranged them in.
   */
  async replace(body: HeroUpdateSchema) {
    await this.prisma.$transaction([
      this.prisma.heroSlide.deleteMany({}),
      this.prisma.heroSlide.createMany({
        data: body.slides.map((slide, index) => ({
          imageUrl: slide.imageUrl,
          title: slide.title,
          subtitle: slide.subtitle,
          ctaLabel: slide.ctaLabel,
          ctaHref: slide.ctaHref,
          sortOrder: index,
          isActive: true,
        })),
      }),
    ]);
    return this.allSlides();
  }
}
