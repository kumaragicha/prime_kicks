import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type MasterKind = 'brand' | 'productType' | 'category';
@Injectable()
export class MastersService {
  constructor(private readonly prisma: PrismaService) {}
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
  create(kind: MasterKind, name: string) { return this.model(kind).create({ data: { name } }); }
  update(kind: MasterKind, id: string, data: { name?: string; isActive?: boolean }) { return this.model(kind).update({ where: { id }, data }); }
  async remove(kind: MasterKind, id: string) { await this.model(kind).delete({ where: { id } }); return { id, deleted: true }; }
  // These Prisma delegates share the same CRUD shape; the cast avoids a union of generic delegates.
  private model(kind: MasterKind): any { return this.prisma[kind]; }
}
