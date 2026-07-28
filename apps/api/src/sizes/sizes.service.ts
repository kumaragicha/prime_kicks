import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CreateSizeSchema,
  CreateSizeTypeSchema,
  UpdateSizeSchema,
  UpdateSizeTypeSchema,
} from '@prime-kicks/validation';
import { PrismaService } from '../prisma/prisma.service';

const sizeTypeInclude = {
  sizes: { orderBy: { sortOrder: 'asc' } },
} satisfies Prisma.SizeTypeInclude;

@Injectable()
export class SizesService {
  constructor(private readonly prisma: PrismaService) {}

  /* --------------------------------- Size types --------------------------------- */

  findAllTypes(includeInactive = false) {
    return this.prisma.sizeType.findMany({
      where: { deletedAt: null, ...(includeInactive ? {} : { isActive: true }) },
      include: sizeTypeInclude,
      orderBy: { name: 'asc' },
    });
  }

  async findType(id: string) {
    const type = await this.prisma.sizeType.findFirst({
      where: { id, deletedAt: null },
      include: sizeTypeInclude,
    });
    if (!type) throw new NotFoundException(`Size type ${id} not found`);
    return type;
  }

  createType(input: CreateSizeTypeSchema) {
    const { sizes, ...data } = input;
    return this.prisma.sizeType.create({
      data: {
        ...data,
        sizes: { create: sizes.map((s) => ({ ...s, conversion: s.conversion ?? null })) },
      },
      include: sizeTypeInclude,
    });
  }

  async updateType(id: string, input: UpdateSizeTypeSchema) {
    await this.findType(id);
    return this.prisma.sizeType.update({
      where: { id },
      data: input,
      include: sizeTypeInclude,
    });
  }

  async removeType(id: string) {
    await this.findType(id);
    const inUse = await this.prisma.product.count({ where: { sizeTypeId: id } });
    if (inUse > 0) {
      throw new BadRequestException(
        `Cannot delete: ${inUse} product(s) still use this size type.`,
      );
    }
    await this.prisma.sizeType.delete({ where: { id } });
    return { id, deleted: true };
  }

  /* ----------------------------------- Sizes ------------------------------------ */

  async addSize(sizeTypeId: string, input: CreateSizeSchema) {
    await this.findType(sizeTypeId);
    return this.prisma.size.create({
      data: { ...input, conversion: input.conversion ?? null, sizeTypeId },
    });
  }

  async updateSize(id: string, input: UpdateSizeSchema) {
    await this.getSize(id);
    return this.prisma.size.update({ where: { id }, data: input });
  }

  async removeSize(id: string) {
    await this.getSize(id);
    const inUse = await this.prisma.productVariant.count({ where: { sizeId: id } });
    if (inUse > 0) {
      throw new BadRequestException(`Cannot delete: ${inUse} product variant(s) use this size.`);
    }
    await this.prisma.size.delete({ where: { id } });
    return { id, deleted: true };
  }

  private async getSize(id: string) {
    const size = await this.prisma.size.findUnique({ where: { id } });
    if (!size) throw new NotFoundException(`Size ${id} not found`);
    return size;
  }
}
