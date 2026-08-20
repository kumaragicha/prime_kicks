import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditEvent, AuditModule } from '@prisma/client';
import type {
  UpdatePricingSettingSchema,
  UpdateShipmozoSettingSchema,
} from '@prime-kicks/validation';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';

const SINGLETON_ID = 'singleton';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Fetch the Shipmozo settings row, creating it on first access. The warehouse
   * id is seeded from the env value so the admin sees the current warehouse
   * without having to re-enter it.
   */
  async getShipmozo() {
    const existing = await this.prisma.shipmozoSetting.findUnique({ where: { id: SINGLETON_ID } });
    if (existing) return existing;
    const seedWarehouse =
      this.config.get<string>('SHIPMOZO_WEARHOUSE_ID')?.trim() ||
      this.config.get<string>('SHIPMOZO_WAREHOUSE_ID')?.trim() ||
      '';
    return this.prisma.shipmozoSetting.create({
      data: { id: SINGLETON_ID, warehouseId: seedWarehouse },
    });
  }

  async updateShipmozo(input: UpdateShipmozoSettingSchema, auditedBy?: string) {
    await this.getShipmozo(); // ensure the row exists
    const updated = await this.prisma.shipmozoSetting.update({
      where: { id: SINGLETON_ID },
      data: input,
    });
    this.audit.log({
      module: AuditModule.SHIPMENTS,
      event: AuditEvent.UPDATION,
      moduleId: updated.id,
      subModule: 'settings',
      action: 'Shipmozo settings updated',
      formData: { ...input },
      auditedBy,
    });
    return updated;
  }

  /**
   * Fetch the global pricing settings row, creating it on first access.
   */
  async getPricing() {
    const existing = await this.prisma.pricingSetting.findUnique({ where: { id: SINGLETON_ID } });
    if (existing) return existing;
    return this.prisma.pricingSetting.create({ data: { id: SINGLETON_ID } });
  }

  async updatePricing(input: UpdatePricingSettingSchema, auditedBy?: string) {
    await this.getPricing(); // ensure the row exists
    const updated = await this.prisma.pricingSetting.update({
      where: { id: SINGLETON_ID },
      data: input,
    });
    this.audit.log({
      module: AuditModule.SHIPMENTS,
      event: AuditEvent.UPDATION,
      moduleId: updated.id,
      subModule: 'settings',
      action: 'Pricing settings updated',
      formData: { ...input },
      auditedBy,
    });
    return updated;
  }
}
