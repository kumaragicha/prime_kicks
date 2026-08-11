import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditEvent, AuditModule } from '@prisma/client';
import type { CreateCourierConfigSchema, UpdateCourierConfigSchema } from '@prime-kicks/validation';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CourierConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  findAll() {
    return this.prisma.courierConfig.findMany({
      orderBy: [{ weightSlab: 'asc' }, { priority: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findOne(id: string) {
    const config = await this.prisma.courierConfig.findUnique({ where: { id } });
    if (!config) throw new NotFoundException('Courier configuration not found');
    return config;
  }

  findByWeightSlab(weightSlab: string) {
    return this.prisma.courierConfig.findMany({
      where: { weightSlab },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async create(input: CreateCourierConfigSchema, auditedBy: string) {
    const last = await this.prisma.courierConfig.aggregate({
      where: { weightSlab: input.weightSlab },
      _max: { priority: true },
    });
    const config = await this.prisma.courierConfig.create({
      data: { ...input, priority: input.priority ?? (last._max.priority ?? -1) + 1 },
    });
    this.writeAudit(AuditEvent.CREATION, config.id, `Courier configuration for ${config.weightSlab} created`, input, auditedBy);
    return config;
  }

  async update(id: string, input: UpdateCourierConfigSchema, auditedBy: string) {
    const existing = await this.findOne(id);
    const config = await this.prisma.courierConfig.update({ where: { id }, data: input });
    this.writeAudit(AuditEvent.UPDATION, config.id, `Courier configuration for ${existing.weightSlab} updated`, input, auditedBy);
    return config;
  }

  async remove(id: string, auditedBy: string) {
    const existing = await this.findOne(id);
    await this.prisma.courierConfig.delete({ where: { id } });
    this.writeAudit(AuditEvent.DELETION, id, `Courier configuration for ${existing.weightSlab} deleted`, undefined, auditedBy);
    return { id, deleted: true };
  }

  private writeAudit(
    event: AuditEvent,
    id: string,
    action: string,
    formData: Record<string, unknown> | undefined,
    auditedBy: string,
  ) {
    this.audit.log({
      module: AuditModule.SHIPMENTS,
      event,
      moduleId: id,
      subModule: 'courier-config',
      action,
      formData,
      auditedBy,
    });
  }
}
