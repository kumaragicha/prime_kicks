import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditEvent, AuditModule, Prisma } from '@prisma/client';
import type {
  CreateDimensionCombinationSchema,
  UpdateDimensionCombinationSchema,
} from '@prime-kicks/validation';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';

const combinationInclude = {
  boxDimension: true,
  items: { include: { dimension: true }, orderBy: { dimensionId: 'asc' } },
} satisfies Prisma.DimensionCombinationInclude;

@Injectable()
export class CombinationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  findAll(includeInactive = false) {
    return this.prisma.dimensionCombination.findMany({
      where: includeInactive ? {} : { isActive: true },
      include: combinationInclude,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const combo = await this.prisma.dimensionCombination.findUnique({
      where: { id },
      include: combinationInclude,
    });
    if (!combo) throw new NotFoundException(`Combination ${id} not found`);
    return combo;
  }

  /** Reject a recipe that lists the same dimension twice (would break the @@unique). */
  private assertUniqueItems(items: { dimensionId: string }[]) {
    const ids = items.map((i) => i.dimensionId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('Each dimension can appear only once in a combination.');
    }
  }

  async create(input: CreateDimensionCombinationSchema, auditedBy?: string) {
    this.assertUniqueItems(input.items);
    const { items, ...data } = input;
    try {
      const combo = await this.prisma.dimensionCombination.create({
        data: {
          ...data,
          items: { create: items.map((i) => ({ dimensionId: i.dimensionId, quantity: i.quantity })) },
        },
        include: combinationInclude,
      });
      this.audit.log({
        module: AuditModule.SHIPMENTS,
        event: AuditEvent.CREATION,
        moduleId: combo.id,
        subModule: 'combination',
        referenceNumber: combo.name,
        action: `Dimension combination "${combo.name}" created`,
        formData: { ...combo },
        auditedBy,
      });
      return combo;
    } catch (error) {
      throw this.mapError(error, input.name);
    }
  }

  async update(id: string, input: UpdateDimensionCombinationSchema, auditedBy?: string) {
    await this.findOne(id);
    if (input.items) this.assertUniqueItems(input.items);
    const { items, ...data } = input;
    try {
      const combo = await this.prisma.$transaction(async (tx) => {
        await tx.dimensionCombination.update({ where: { id }, data });
        // Replace the recipe wholesale when items are provided.
        if (items) {
          await tx.dimensionCombinationItem.deleteMany({ where: { combinationId: id } });
          await tx.dimensionCombinationItem.createMany({
            data: items.map((i) => ({ combinationId: id, dimensionId: i.dimensionId, quantity: i.quantity })),
          });
        }
        return tx.dimensionCombination.findUniqueOrThrow({ where: { id }, include: combinationInclude });
      });
      this.audit.log({
        module: AuditModule.SHIPMENTS,
        event: AuditEvent.UPDATION,
        moduleId: combo.id,
        subModule: 'combination',
        referenceNumber: combo.name,
        action: `Dimension combination "${combo.name}" updated`,
        formData: { ...combo },
        auditedBy,
      });
      return combo;
    } catch (error) {
      throw this.mapError(error, input.name);
    }
  }

  async remove(id: string, auditedBy?: string) {
    const combo = await this.findOne(id);
    await this.prisma.dimensionCombination.delete({ where: { id } });
    this.audit.log({
      module: AuditModule.SHIPMENTS,
      event: AuditEvent.DELETION,
      moduleId: id,
      subModule: 'combination',
      referenceNumber: combo.name,
      action: `Dimension combination "${combo.name}" deleted`,
      auditedBy,
    });
    return { id, deleted: true };
  }

  private mapError(error: unknown, name?: string) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return new BadRequestException(`A combination named "${name ?? ''}" already exists.`);
    }
    return error instanceof Error ? error : new Error(String(error));
  }
}
