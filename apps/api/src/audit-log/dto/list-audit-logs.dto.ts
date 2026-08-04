import { AuditEvent, AuditModule } from '@prisma/client';
import { z } from 'zod';

/** Query params for the paginated audit-log list. */
export const listAuditLogsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
  module: z.nativeEnum(AuditModule).optional(),
  event: z.nativeEnum(AuditEvent).optional(),
  moduleId: z.string().optional(),
  auditedBy: z.string().optional(),
  referenceNumber: z.string().optional(),
  /** ISO date/time — inclusive lower bound on createdAt. */
  from: z.string().optional(),
  /** ISO date/time — inclusive upper bound on createdAt. */
  to: z.string().optional(),
});

export type ListAuditLogsDto = z.infer<typeof listAuditLogsSchema>;
