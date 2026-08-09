import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

/** Size masters: each type with its ordered sizes (label + optional conversion). */
const sizeTypes = [
  {
    name: 'Nike',
    sizes: [
      { label: '36', conversion: 'UK 3', sortOrder: 1 },
      { label: '37', conversion: 'UK 3.5', sortOrder: 2 },
      { label: '38', conversion: 'UK 4', sortOrder: 3 },
      { label: '39', conversion: 'UK 5', sortOrder: 4 },
    ],
  },
  {
    name: 'Adidas',
    sizes: [
      { label: '36', conversion: 'UK 3', sortOrder: 1 },
      { label: '37', conversion: 'UK 4', sortOrder: 2 },
      { label: '38', conversion: 'UK 5', sortOrder: 3 },
    ],
  },
  {
    name: 'Crocs',
    sizes: [
      { label: 'M3', conversion: null, sortOrder: 1 },
      { label: 'M4', conversion: null, sortOrder: 2 },
      { label: 'M5', conversion: null, sortOrder: 3 },
    ],
  },
];

/** Products reference a size type by name and hold per-size stock by label. */
const products = [
  {
    sku: 'AJ1-CHI-2015',
    name: 'Air Jordan 1 Retro High OG "Chicago"',
    brand: 'Jordan',
    description: '2015 release, box included.',
    sizeTypeName: 'Nike',
    variants: [{ label: '38', stock: 1 }],
    inhouseCost: 16000,
    resellerPrice: 40000,
    customerPrice: 45000,
    currency: 'INR',
    releaseYear: 2015,
  },
  {
    sku: 'DZ5485-612',
    name: 'Air Jordan 1 Retro High OG "Lost & Found"',
    brand: 'Jordan',
    description: 'Chicago reimagined with vintage detailing.',
    sizeTypeName: 'Nike',
    variants: [
      { label: '37', stock: 2 },
      { label: '38', stock: 1 },
    ],
    inhouseCost: 18000,
    resellerPrice: 24000,
    customerPrice: 26000,
    currency: 'INR',
    releaseYear: 2022,
  },
  {
    sku: 'DD1391-100',
    name: 'Nike Dunk Low "Panda"',
    brand: 'Nike',
    description: 'Everyday black-and-white staple.',
    sizeTypeName: 'Nike',
    variants: [
      { label: '38', stock: 4 },
      { label: '39', stock: 4 },
    ],
    inhouseCost: 9000,
    resellerPrice: 12000,
    customerPrice: 13500,
    currency: 'INR',
    releaseYear: 2021,
  },
  {
    sku: 'GX3724',
    name: 'Yeezy Boost 350 V2 "Bone"',
    brand: 'adidas',
    description: 'Clean triple-tonal 350.',
    sizeTypeName: 'Adidas',
    variants: [
      { label: '37', stock: 1 },
      { label: '38', stock: 1 },
    ],
    inhouseCost: 20000,
    resellerPrice: 21000,
    customerPrice: 23000,
    currency: 'INR',
    releaseYear: 2022,
  },
];

async function main() {
  console.log('🌱 Seeding database...');

  const passwordHash = await hash('password123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@primekicks.dev' },
    update: { passwordHash },
    create: {
      firstName: 'Prime',
      lastName: 'Admin',
      name: 'Prime Admin',
      email: 'admin@primekicks.dev',
      mobileNo: '+919000000001',
      city: 'Mumbai',
      state: 'Maharashtra',
      role: 'ADMIN',
      isEmailVerified: true,
      passwordHash,
    },
  });
  console.log(`  ✓ user ${admin.email} (password: password123)`);

  const reseller = await prisma.user.upsert({
    where: { email: 'reseller@primekicks.dev' },
    update: { passwordHash },
    create: {
      firstName: 'Prime',
      lastName: 'Reseller',
      name: 'Prime Reseller',
      email: 'reseller@primekicks.dev',
      mobileNo: '+919000000002',
      city: 'Bengaluru',
      state: 'Karnataka',
      role: 'RESELLER',
      isEmailVerified: true,
      passwordHash,
    },
  });
  console.log(`  ✓ user ${reseller.email} (password: password123)`);

  // Size types + sizes. `sizeIdOf[typeName][label]` → Size id, for wiring variants.
  const sizeIdOf: Record<string, Record<string, string>> = {};
  for (const type of sizeTypes) {
    const created = await prisma.sizeType.upsert({
      where: { name: type.name },
      update: {},
      create: { name: type.name },
    });
    sizeIdOf[type.name] = {};
    for (const size of type.sizes) {
      const s = await prisma.size.upsert({
        where: { sizeTypeId_label: { sizeTypeId: created.id, label: size.label } },
        update: { conversion: size.conversion, sortOrder: size.sortOrder },
        create: { ...size, sizeTypeId: created.id },
      });
      sizeIdOf[type.name]![size.label] = s.id;
    }
    console.log(`  ✓ size type ${created.name} (${type.sizes.length} sizes)`);
  }

  for (const { sizeTypeName, variants, ...product } of products) {
    const typeSizes = sizeIdOf[sizeTypeName]!;
    const sizeType = await prisma.sizeType.findUniqueOrThrow({ where: { name: sizeTypeName } });

    const created = await prisma.product.upsert({
      where: { sku: product.sku },
      update: { ...product, sizeTypeId: sizeType.id },
      create: {
        ...product,
        sizeTypeId: sizeType.id,
        variants: {
          create: variants.map((v) => ({ sizeId: typeSizes[v.label]!, stock: v.stock })),
        },
      },
    });
    const total = variants.reduce((sum, v) => sum + v.stock, 0);
    console.log(`  ✓ product ${created.sku} — ${sizeTypeName}, ${total} in stock`);
  }

  // Dimension masters: only 4 product dimensions (no separate box dimensions).
  const dimensionDefs = [
    { name: 'Small (Converse, Vans, Crocs)', weight: 0.5, length: 24, width: 16, height: 8 },
    { name: 'Medium (Ballet)', weight: 0.8, length: 28, width: 18, height: 10 },
    { name: 'Large (Airforce, Speed cat)', weight: 1.2, length: 32, width: 20, height: 12 },
    { name: 'Extra Large (Multiple shoes)', weight: 5, length: 40, width: 30, height: 20 },
  ];

  const dimensionIdOf: Record<string, string> = {};
  for (const def of dimensionDefs) {
    const dim = await prisma.dimension.upsert({
      where: { name: def.name },
      update: { ...def, isActive: true },
      create: { ...def, isActive: true },
    });
    dimensionIdOf[def.name] = dim.id;
    console.log(`  ✓ dimension ${dim.name}`);
  }

  // Dimension combinations: for 2–4 units, match the basket to a recipe.
  // All combos use the Extra Large box (40×30×20 cm, 5 kg) as the shipping box.
  // Weight is always 5 kg (from the Extra Large dimension master).
  const combinationDefs = [
    {
      name: 'Large × 2',
      items: [{ dimensionId: dimensionIdOf['Large (Airforce, Speed cat)'], quantity: 2 }],
    },
    {
      name: 'Large × 1 + Medium × 1',
      items: [
        { dimensionId: dimensionIdOf['Large (Airforce, Speed cat)'], quantity: 1 },
        { dimensionId: dimensionIdOf['Medium (Ballet)'], quantity: 1 },
      ],
    },
    {
      name: 'Large × 1 + Small × 1',
      items: [
        { dimensionId: dimensionIdOf['Large (Airforce, Speed cat)'], quantity: 1 },
        { dimensionId: dimensionIdOf['Small (Converse, Vans, Crocs)'], quantity: 1 },
      ],
    },
    { name: 'Medium × 2', items: [{ dimensionId: dimensionIdOf['Medium (Ballet)'], quantity: 2 }] },
    {
      name: 'Medium × 1 + Small × 1',
      items: [
        { dimensionId: dimensionIdOf['Medium (Ballet)'], quantity: 1 },
        { dimensionId: dimensionIdOf['Small (Converse, Vans, Crocs)'], quantity: 1 },
      ],
    },
    {
      name: 'Small × 2',
      items: [{ dimensionId: dimensionIdOf['Small (Converse, Vans, Crocs)'], quantity: 2 }],
    },
    {
      name: 'Large × 3',
      items: [{ dimensionId: dimensionIdOf['Large (Airforce, Speed cat)'], quantity: 3 }],
    },
    {
      name: 'Large × 2 + Medium × 1',
      items: [
        { dimensionId: dimensionIdOf['Large (Airforce, Speed cat)'], quantity: 2 },
        { dimensionId: dimensionIdOf['Medium (Ballet)'], quantity: 1 },
      ],
    },
    {
      name: 'Large × 2 + Small × 1',
      items: [
        { dimensionId: dimensionIdOf['Large (Airforce, Speed cat)'], quantity: 2 },
        { dimensionId: dimensionIdOf['Small (Converse, Vans, Crocs)'], quantity: 1 },
      ],
    },
    {
      name: 'Large × 1 + Medium × 2',
      items: [
        { dimensionId: dimensionIdOf['Large (Airforce, Speed cat)'], quantity: 1 },
        { dimensionId: dimensionIdOf['Medium (Ballet)'], quantity: 2 },
      ],
    },
    {
      name: 'Large × 1 + Medium × 1 + Small × 1',
      items: [
        { dimensionId: dimensionIdOf['Large (Airforce, Speed cat)'], quantity: 1 },
        { dimensionId: dimensionIdOf['Medium (Ballet)'], quantity: 1 },
        { dimensionId: dimensionIdOf['Small (Converse, Vans, Crocs)'], quantity: 1 },
      ],
    },
    {
      name: 'Large × 1 + Small × 2',
      items: [
        { dimensionId: dimensionIdOf['Large (Airforce, Speed cat)'], quantity: 1 },
        { dimensionId: dimensionIdOf['Small (Converse, Vans, Crocs)'], quantity: 2 },
      ],
    },
    { name: 'Medium × 3', items: [{ dimensionId: dimensionIdOf['Medium (Ballet)'], quantity: 3 }] },
    {
      name: 'Medium × 2 + Small × 1',
      items: [
        { dimensionId: dimensionIdOf['Medium (Ballet)'], quantity: 2 },
        { dimensionId: dimensionIdOf['Small (Converse, Vans, Crocs)'], quantity: 1 },
      ],
    },
    {
      name: 'Medium × 1 + Small × 2',
      items: [
        { dimensionId: dimensionIdOf['Medium (Ballet)'], quantity: 1 },
        { dimensionId: dimensionIdOf['Small (Converse, Vans, Crocs)'], quantity: 2 },
      ],
    },
    {
      name: 'Small × 3',
      items: [{ dimensionId: dimensionIdOf['Small (Converse, Vans, Crocs)'], quantity: 3 }],
    },
    {
      name: 'Large × 4',
      items: [{ dimensionId: dimensionIdOf['Large (Airforce, Speed cat)'], quantity: 4 }],
    },
    {
      name: 'Large × 3 + Medium × 1',
      items: [
        { dimensionId: dimensionIdOf['Large (Airforce, Speed cat)'], quantity: 3 },
        { dimensionId: dimensionIdOf['Medium (Ballet)'], quantity: 1 },
      ],
    },
    {
      name: 'Large × 3 + Small × 1',
      items: [
        { dimensionId: dimensionIdOf['Large (Airforce, Speed cat)'], quantity: 3 },
        { dimensionId: dimensionIdOf['Small (Converse, Vans, Crocs)'], quantity: 1 },
      ],
    },
    {
      name: 'Large × 2 + Medium × 2',
      items: [
        { dimensionId: dimensionIdOf['Large (Airforce, Speed cat)'], quantity: 2 },
        { dimensionId: dimensionIdOf['Medium (Ballet)'], quantity: 2 },
      ],
    },
    {
      name: 'Large × 2 + Medium × 1 + Small × 1',
      items: [
        { dimensionId: dimensionIdOf['Large (Airforce, Speed cat)'], quantity: 2 },
        { dimensionId: dimensionIdOf['Medium (Ballet)'], quantity: 1 },
        { dimensionId: dimensionIdOf['Small (Converse, Vans, Crocs)'], quantity: 1 },
      ],
    },
    {
      name: 'Large × 2 + Small × 2',
      items: [
        { dimensionId: dimensionIdOf['Large (Airforce, Speed cat)'], quantity: 2 },
        { dimensionId: dimensionIdOf['Small (Converse, Vans, Crocs)'], quantity: 2 },
      ],
    },
    {
      name: 'Large × 1 + Medium × 3',
      items: [
        { dimensionId: dimensionIdOf['Large (Airforce, Speed cat)'], quantity: 1 },
        { dimensionId: dimensionIdOf['Medium (Ballet)'], quantity: 3 },
      ],
    },
    {
      name: 'Large × 1 + Medium × 2 + Small × 1',
      items: [
        { dimensionId: dimensionIdOf['Large (Airforce, Speed cat)'], quantity: 1 },
        { dimensionId: dimensionIdOf['Medium (Ballet)'], quantity: 2 },
        { dimensionId: dimensionIdOf['Small (Converse, Vans, Crocs)'], quantity: 1 },
      ],
    },
    {
      name: 'Large × 1 + Medium × 1 + Small × 2',
      items: [
        { dimensionId: dimensionIdOf['Large (Airforce, Speed cat)'], quantity: 1 },
        { dimensionId: dimensionIdOf['Medium (Ballet)'], quantity: 1 },
        { dimensionId: dimensionIdOf['Small (Converse, Vans, Crocs)'], quantity: 2 },
      ],
    },
    {
      name: 'Large × 1 + Small × 3',
      items: [
        { dimensionId: dimensionIdOf['Large (Airforce, Speed cat)'], quantity: 1 },
        { dimensionId: dimensionIdOf['Small (Converse, Vans, Crocs)'], quantity: 3 },
      ],
    },
    { name: 'Medium × 4', items: [{ dimensionId: dimensionIdOf['Medium (Ballet)'], quantity: 4 }] },
    {
      name: 'Medium × 3 + Small × 1',
      items: [
        { dimensionId: dimensionIdOf['Medium (Ballet)'], quantity: 3 },
        { dimensionId: dimensionIdOf['Small (Converse, Vans, Crocs)'], quantity: 1 },
      ],
    },
    {
      name: 'Medium × 2 + Small × 2',
      items: [
        { dimensionId: dimensionIdOf['Medium (Ballet)'], quantity: 2 },
        { dimensionId: dimensionIdOf['Small (Converse, Vans, Crocs)'], quantity: 2 },
      ],
    },
    {
      name: 'Medium × 1 + Small × 3',
      items: [
        { dimensionId: dimensionIdOf['Medium (Ballet)'], quantity: 1 },
        { dimensionId: dimensionIdOf['Small (Converse, Vans, Crocs)'], quantity: 3 },
      ],
    },
    {
      name: 'Small × 4',
      items: [{ dimensionId: dimensionIdOf['Small (Converse, Vans, Crocs)'], quantity: 4 }],
    },
  ];

  // Clear old combinations before re-seeding to avoid duplicates.
  await prisma.dimensionCombinationItem.deleteMany({});
  await prisma.dimensionCombination.deleteMany({});

  for (const def of combinationDefs) {
    const boxId = dimensionIdOf['Extra Large (Multiple shoes)']!;
    const combo = await prisma.dimensionCombination.create({
      data: {
        name: def.name,
        weight: 5,
        boxDimensionId: boxId,
        isActive: true,
        items: {
          create: def.items.map((i) => ({
            dimensionId: i.dimensionId as string,
            quantity: i.quantity,
          })),
        },
      },
    });
    console.log(`  ✓ combination ${combo.name}`);
  }

  console.log('✅ Seed complete');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
