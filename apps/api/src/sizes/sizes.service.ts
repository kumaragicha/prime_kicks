import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditEvent, AuditModule, Prisma } from '@prisma/client';
import type {
  CreateSizeSchema,
  CreateSizeTypeSchema,
  UpdateSizeSchema,
  UpdateSizeTypeSchema,
} from '@prime-kicks/validation';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';

const sizeTypeInclude = {
  sizes: { orderBy: { sortOrder: 'asc' } },
} satisfies Prisma.SizeTypeInclude;

@Injectable()
export class SizesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

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

  async createType(input: CreateSizeTypeSchema, auditedBy?: string) {
    const { sizes, ...data } = input;
    const sizeType = await this.prisma.sizeType.create({
      data: {
        ...data,
        sizes: { create: sizes.map((s) => ({ ...s, conversion: s.conversion ?? null })) },
      },
      include: sizeTypeInclude,
    });
    this.audit.log({
      module: AuditModule.SIZE_TYPES,
      event: AuditEvent.CREATION,
      moduleId: sizeType.id,
      referenceNumber: sizeType.name,
      action: `Size type "${sizeType.name}" created`,
      formData: { ...sizeType },
      auditedBy,
    });
    return sizeType;
  }

  async updateType(id: string, input: UpdateSizeTypeSchema, auditedBy?: string) {
    await this.findType(id);
    const sizeType = await this.prisma.sizeType.update({
      where: { id },
      data: input,
      include: sizeTypeInclude,
    });
    this.audit.log({
      module: AuditModule.SIZE_TYPES,
      event: AuditEvent.UPDATION,
      moduleId: sizeType.id,
      referenceNumber: sizeType.name,
      action: `Size type "${sizeType.name}" updated`,
      formData: { ...sizeType },
      auditedBy,
    });
    return sizeType;
  }

  async removeType(id: string, auditedBy?: string) {
    const sizeType = await this.findType(id);
    const inUse = await this.prisma.product.count({ where: { sizeTypeId: id } });
    if (inUse > 0) {
      throw new BadRequestException(
        `Cannot delete: ${inUse} product(s) still use this size type.`,
      );
    }
    await this.prisma.sizeType.delete({ where: { id } });
    this.audit.log({
      module: AuditModule.SIZE_TYPES,
      event: AuditEvent.DELETION,
      moduleId: id,
      referenceNumber: sizeType.name,
      action: `Size type "${sizeType.name}" deleted`,
      auditedBy,
    });
    return { id, deleted: true };
  }

  /* ----------------------------------- Sizes ------------------------------------ */

  async addSize(sizeTypeId: string, input: CreateSizeSchema, auditedBy?: string) {
    await this.findType(sizeTypeId);
    const size = await this.prisma.size.create({
      data: { ...input, conversion: input.conversion ?? null, sizeTypeId },
    });
    this.audit.log({
      module: AuditModule.SIZES,
      event: AuditEvent.CREATION,
      moduleId: size.id,
      subModule: sizeTypeId,
      referenceNumber: size.label,
      action: `Size "${size.label}" added`,
      formData: { ...size },
      auditedBy,
    });
    return size;
  }

  async updateSize(id: string, input: UpdateSizeSchema, auditedBy?: string) {
    await this.getSize(id);
    const size = await this.prisma.size.update({ where: { id }, data: input });
    this.audit.log({
      module: AuditModule.SIZES,
      event: AuditEvent.UPDATION,
      moduleId: size.id,
      subModule: size.sizeTypeId,
      referenceNumber: size.label,
      action: `Size "${size.label}" updated`,
      formData: { ...size },
      auditedBy,
    });
    return size;
  }

  async removeSize(id: string, auditedBy?: string) {
    const size = await this.getSize(id);
    const inUse = await this.prisma.productVariant.count({ where: { sizeId: id } });
    if (inUse > 0) {
      throw new BadRequestException(`Cannot delete: ${inUse} product variant(s) use this size.`);
    }
    await this.prisma.size.delete({ where: { id } });
    this.audit.log({
      module: AuditModule.SIZES,
      event: AuditEvent.DELETION,
      moduleId: id,
      subModule: size.sizeTypeId,
      referenceNumber: size.label,
      action: `Size "${size.label}" deleted`,
      auditedBy,
    });
    return { id, deleted: true };
  }

  private async getSize(id: string) {
    const size = await this.prisma.size.findUnique({ where: { id } });
    if (!size) throw new NotFoundException(`Size ${id} not found`);
    return size;
  }
}
