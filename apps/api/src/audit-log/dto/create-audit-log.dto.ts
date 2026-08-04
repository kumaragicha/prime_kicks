import type { AuditEvent, AuditModule } from '@prisma/client';

/** Input for writing a single audit-log entry. */
export interface CreateAuditLogDto {
  module: AuditModule;
  event: AuditEvent;
  action: string;
  /** id of the affected row (cuid); omit for bulk/none. */
  moduleId?: string | null;
  subModule?: string | null;
  /** Snapshot of the payload/entity at the time of the change. */
  formData?: Record<string, unknown> | null;
  /** Human-facing reference for the affected row (order number, SKU, …). */
  referenceNumber?: string | null;
  /** Email of the acting user; falls back to "system" when absent. */
  auditedBy?: string | null;
}
