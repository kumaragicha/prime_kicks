import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditEvent, AuditModule } from '@prisma/client';
import type { CreateDimensionSchema, UpdateDimensionSchema } from '@prime-kicks/validation';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DimensionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  findAll(includeInactive = false) {
    return this.prisma.dimension.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const dimension = await this.prisma.dimension.findUnique({ where: { id } });
    if (!dimension) throw new NotFoundException(`Dimension ${id} not found`);
    return dimension;
  }

  async create(input: CreateDimensionSchema, auditedBy?: string) {
    const dimension = await this.prisma.dimension.create({ data: input });
    this.audit.log({
      module: AuditModule.DIMENSIONS,
      event: AuditEvent.CREATION,
      moduleId: dimension.id,
      referenceNumber: dimension.name,
      action: `Dimension "${dimension.name}" created`,
      formData: { ...dimension },
      auditedBy,
    });
    return dimension;
  }

  async update(id: string, input: UpdateDimensionSchema, auditedBy?: string) {
    await this.findOne(id);
    const dimension = await this.prisma.dimension.update({ where: { id }, data: input });
    this.audit.log({
      module: AuditModule.DIMENSIONS,
      event: AuditEvent.UPDATION,
      moduleId: dimension.id,
      referenceNumber: dimension.name,
      action: `Dimension "${dimension.name}" updated`,
      formData: { ...dimension },
      auditedBy,
    });
    return dimension;
  }

  async remove(id: string, auditedBy?: string) {
    const dimension = await this.findOne(id);
    const inUse = await this.prisma.product.count({ where: { dimensionId: id } });
    if (inUse > 0) {
      throw new BadRequestException(
        `Cannot delete: ${inUse} product(s) still use this dimension.`,
      );
    }
    await this.prisma.dimension.delete({ where: { id } });
    this.audit.log({
      module: AuditModule.DIMENSIONS,
      event: AuditEvent.DELETION,
      moduleId: id,
      referenceNumber: dimension.name,
      action: `Dimension "${dimension.name}" deleted`,
      auditedBy,
    });
    return { id, deleted: true };
  }
}
