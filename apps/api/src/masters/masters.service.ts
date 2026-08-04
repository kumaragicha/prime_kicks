import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditEvent, AuditModule } from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';

type MasterKind = 'brand' | 'productType' | 'category';

/** Map a master resource to its audit module. */
const AUDIT_MODULE_FOR: Record<MasterKind, AuditModule> = {
  brand: AuditModule.BRANDS,
  productType: AuditModule.PRODUCT_TYPES,
  category: AuditModule.CATEGORIES,
};

@Injectable()
export class MastersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}
  list(kind: MasterKind, includeInactive = false) { return this.model(kind).findMany({ where: includeInactive ? {} : { isActive: true }, orderBy: { name: 'asc' } }); }

  /** Combined facets for the storefront filter drawer: active brands + categories in one call. */
  async filters() {
    const select = { id: true, name: true };
    const [brands, categories] = await Promise.all([
      this.prisma.brand.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select }),
      this.prisma.category.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select }),
    ]);
    return { brands, categories };
  }
  async create(kind: MasterKind, name: string, auditedBy?: string) {
    const row = await this.model(kind).create({ data: { name } });
    this.audit.log({
      module: AUDIT_MODULE_FOR[kind],
      event: AuditEvent.CREATION,
      moduleId: row.id,
      referenceNumber: row.name,
      action: `${kind} "${row.name}" created`,
      formData: { ...row },
      auditedBy,
    });
    return row;
  }
  async update(
    kind: MasterKind,
    id: string,
    data: { name?: string; isActive?: boolean },
    auditedBy?: string,
  ) {
    const row = await this.model(kind).update({ where: { id }, data });
    this.audit.log({
      module: AUDIT_MODULE_FOR[kind],
      event: AuditEvent.UPDATION,
      moduleId: row.id,
      referenceNumber: row.name,
      action: `${kind} "${row.name}" updated`,
      formData: { ...row },
      auditedBy,
    });
    return row;
  }
  async remove(kind: MasterKind, id: string, auditedBy?: string) {
    await this.model(kind).delete({ where: { id } });
    this.audit.log({
      module: AUDIT_MODULE_FOR[kind],
      event: AuditEvent.DELETION,
      moduleId: id,
      action: `${kind} deleted`,
      auditedBy,
    });
    return { id, deleted: true };
  }
  // These Prisma delegates share the same CRUD shape; the cast avoids a union of generic delegates.
  private model(kind: MasterKind): any { return this.prisma[kind]; }
}
