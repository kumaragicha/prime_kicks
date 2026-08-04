import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateAuditLogDto } from './dto/create-audit-log.dto';
import type { ListAuditLogsDto } from './dto/list-audit-logs.dto';

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Write an audit entry WITHOUT blocking the caller. The insert runs in the
   * background and any failure is logged, never thrown — so an audit bug can
   * never break (or slow) the real operation that triggered it.
   */
  log(entry: CreateAuditLogDto): void {
    void this.createLog(entry).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to write audit log (${entry.module}/${entry.event}): ${message}`);
    });
  }

  /** Await the write and return the created row. Prefer {@link log} for hot paths. */
  createLog(entry: CreateAuditLogDto) {
    return this.prisma.auditLog.create({
      data: {
        module: entry.module,
        event: entry.event,
        action: entry.action,
        moduleId: entry.moduleId ?? null,
        subModule: entry.subModule ?? null,
        referenceNumber: entry.referenceNumber ?? null,
        auditedBy: entry.auditedBy || 'system',
        // Round-trip through JSON so non-plain values (Date, undefined, …) become
        // valid JSONB instead of throwing on insert.
        formData: sanitizeFormData(entry.formData),
      },
    });
  }

  /** Paginated list with optional filters. Newest first. */
  async list(query: ListAuditLogsDto) {
    const { page, limit } = query;

    const where: Prisma.AuditLogWhereInput = {};
    if (query.module) where.module = query.module;
    if (query.event) where.event = query.event;
    if (query.moduleId) where.moduleId = query.moduleId;
    if (query.auditedBy) where.auditedBy = { contains: query.auditedBy, mode: 'insensitive' };
    if (query.referenceNumber) {
      where.referenceNumber = { contains: query.referenceNumber, mode: 'insensitive' };
    }
    if (query.from || query.to) {
      where.createdAt = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  /** Single entry by id. 404 if not found. */
  async findById(id: string) {
    const log = await this.prisma.auditLog.findUnique({ where: { id } });
    if (!log) throw new NotFoundException(`Audit log ${id} not found`);
    return log;
  }
}

/** Coerce an arbitrary payload into JSONB-safe input (or DB NULL). */
function sanitizeFormData(
  formData: CreateAuditLogDto['formData'],
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (formData === undefined || formData === null) return Prisma.JsonNull;
  try {
    return JSON.parse(JSON.stringify(formData)) as Prisma.InputJsonValue;
  } catch {
    return Prisma.JsonNull;
  }
}
