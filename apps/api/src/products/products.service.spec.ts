import { ConflictException } from '@nestjs/common';
import { ProductsService } from './products.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuditLogService } from '../audit-log/audit-log.service';
import type { CreateProductSchema } from '@prime-kicks/validation';

/**
 * Covers the one-name-per-brand guard. Prisma is stubbed: only the calls the
 * guard makes are wired up, and `product.create` throws if it is ever reached so
 * a missing guard can't pass silently.
 */
describe('ProductsService — duplicate name guard', () => {
  const brand = { id: 'brand-1', name: 'Nike' };

  function build(existing: { name: string; sku: string } | null) {
    const findFirst = jest.fn().mockResolvedValue(existing);
    const prisma = {
      brand: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(brand),
        findUnique: jest.fn().mockResolvedValue(brand),
      },
      product: {
        findFirst,
        create: jest.fn(() => {
          throw new Error('create should not run when the name clashes');
        }),
      },
    } as unknown as PrismaService;
    const audit = { log: jest.fn() } as unknown as AuditLogService;
    return { service: new ProductsService(prisma, audit), prisma, findFirst };
  }

  const input = (name: string) =>
    ({
      name,
      brandId: brand.id,
      sku: '',
      productTypeIds: ['t1'],
      categoryIds: ['c1'],
      tagIds: [],
      description: '',
      photoUrls: [],
      videoUrl: null,
      inhouseCost: 100,
      resellerPrice: 200,
      customerPrice: 300,
      currency: 'INR',
      releaseYear: null,
      isActive: true,
      sizeTypeId: 'st1',
      variants: [],
      dimensionId: null,
      model: null,
    }) as CreateProductSchema;

  it('rejects a create whose name already exists for the brand', async () => {
    const { service } = build({ name: 'Air Max 90', sku: 'NIK-1' });

    await expect(service.create(input('Air Max 90'))).rejects.toThrow(ConflictException);
  });

  it('matches case-insensitively and ignores surrounding whitespace', async () => {
    const { service, findFirst } = build({ name: 'Air Max 90', sku: 'NIK-1' });

    await expect(service.create(input('  air max 90 '))).rejects.toThrow(ConflictException);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          brandId: brand.id,
          deletedAt: null,
          name: { equals: 'air max 90', mode: 'insensitive' },
        }),
      }),
    );
  });

  it('names the clashing product and its SKU in the error', async () => {
    const { service } = build({ name: 'Air Max 90', sku: 'NIK-1' });

    await expect(service.create(input('Air Max 90'))).rejects.toThrow(/Nike.*Air Max 90.*NIK-1/s);
  });

  it('lets a free name through to the create', async () => {
    const { service } = build(null);

    // Reaches `product.create`, which this stub throws from — proof the guard
    // passed rather than that the whole call was short-circuited.
    await expect(service.create(input('Air Max 95'))).rejects.toThrow(
      'create should not run when the name clashes',
    );
  });
});
