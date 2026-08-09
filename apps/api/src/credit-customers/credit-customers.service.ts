import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateCreditCustomerSchema,
  CreditCustomerQuerySchema,
  UpdateCreditCustomerSchema,
} from '@prime-kicks/validation';
import { AuditEvent, AuditModule, Prisma } from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';

/** Columns exposed to the admin UI. */
const creditCustomerSelect = {
  id: true,
  name: true,
  mobileNo: true,
  email: true,
  city: true,
  state: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CreditCustomerSelect;

/** Trim a value and collapse an empty string to null (for optional fields). */
function orNull(v: string | undefined): string | null {
  const s = v?.trim();
  return s ? s : null;
}

@Injectable()
export class CreditCustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async findAll(query: CreditCustomerQuerySchema) {
    const { page, pageSize, search } = query;
    const where: Prisma.CreditCustomerWhereInput = {
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { mobileNo: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.creditCustomer.findMany({
        where,
        select: creditCustomerSelect,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.creditCustomer.count({ where }),
    ]);

    return {
      data: data.map(toDto),
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async findOne(id: string) {
    const row = await this.prisma.creditCustomer.findFirst({
      where: { id, deletedAt: null },
      select: creditCustomerSelect,
    });
    if (!row) throw new NotFoundException('Credit customer not found');
    return toDto(row);
  }

  async create(dto: CreateCreditCustomerSchema, auditedBy?: string) {
    const created = await this.prisma.creditCustomer.create({
      data: {
        name: dto.name.trim(),
        mobileNo: dto.mobileNo.trim(),
        email: orNull(dto.email),
        city: orNull(dto.city),
        state: orNull(dto.state),
        notes: orNull(dto.notes),
      },
      select: creditCustomerSelect,
    });
    this.audit.log({
      module: AuditModule.CREDIT_CUSTOMERS,
      event: AuditEvent.CREATION,
      moduleId: created.id,
      referenceNumber: created.name,
      action: `Credit customer "${created.name}" created`,
      auditedBy,
    });
    return toDto(created);
  }

  async update(id: string, dto: UpdateCreditCustomerSchema, auditedBy?: string) {
    await this.findOne(id); // 404 if missing/deleted
    const updated = await this.prisma.creditCustomer.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.mobileNo !== undefined ? { mobileNo: dto.mobileNo.trim() } : {}),
        ...(dto.email !== undefined ? { email: orNull(dto.email) } : {}),
        ...(dto.city !== undefined ? { city: orNull(dto.city) } : {}),
        ...(dto.state !== undefined ? { state: orNull(dto.state) } : {}),
        ...(dto.notes !== undefined ? { notes: orNull(dto.notes) } : {}),
      },
      select: creditCustomerSelect,
    });
    this.audit.log({
      module: AuditModule.CREDIT_CUSTOMERS,
      event: AuditEvent.UPDATION,
      moduleId: id,
      referenceNumber: updated.name,
      action: `Credit customer "${updated.name}" updated`,
      formData: dto,
      auditedBy,
    });
    return toDto(updated);
  }

  async remove(id: string, auditedBy?: string) {
    const existing = await this.findOne(id);
    await this.prisma.creditCustomer.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    this.audit.log({
      module: AuditModule.CREDIT_CUSTOMERS,
      event: AuditEvent.DELETION,
      moduleId: id,
      referenceNumber: existing.name,
      action: `Credit customer "${existing.name}" deleted`,
      auditedBy,
    });
    return { id, deleted: true };
  }
}

type CreditCustomerRow = Prisma.CreditCustomerGetPayload<{ select: typeof creditCustomerSelect }>;

/** Serialize a row to the API DTO (dates as ISO strings). */
function toDto(row: CreditCustomerRow) {
  return {
    id: row.id,
    name: row.name,
    mobileNo: row.mobileNo,
    email: row.email,
    city: row.city,
    state: row.state,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
