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

  console.log('✅ Seed complete');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
