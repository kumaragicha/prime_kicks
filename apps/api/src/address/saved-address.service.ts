import { Injectable, NotFoundException } from '@nestjs/common';
import type { SavedAddress } from '@prisma/client';
import type { OrderAddressSchema } from '@prime-kicks/validation';
import { PrismaService } from '../prisma/prisma.service';

/** A saved address as the storefront checkout uses it (form fields + id). */
export type SavedAddressDto = OrderAddressSchema & { id: string };

/** Cap per customer so the list stays usable at checkout. */
const MAX_SAVED_ADDRESSES = 10;

function toDto(row: SavedAddress): SavedAddressDto {
  return {
    id: row.id,
    name: row.name,
    email: row.email ?? '',
    mobileNo: row.mobileNo,
    altMobileNo: row.altMobileNo ?? '',
    line1: row.line1,
    line2: row.line2,
    landmark: row.landmark,
    pincode: row.pincode,
    city: row.city,
    state: row.state,
  };
}

function toData(addr: OrderAddressSchema) {
  return {
    name: addr.name.trim(),
    email: addr.email?.trim() || null,
    mobileNo: addr.mobileNo.trim(),
    altMobileNo: addr.altMobileNo?.trim() || null,
    line1: addr.line1.trim(),
    line2: addr.line2?.trim() ?? '',
    landmark: addr.landmark?.trim() ?? '',
    pincode: addr.pincode.trim(),
    city: addr.city.trim(),
    state: addr.state.trim(),
  };
}

/**
 * A customer's saved checkout addresses. Created when they tick "Save this
 * address for future orders", then offered as selectable cards at checkout.
 * Every operation is scoped to the authenticated caller.
 */
@Injectable()
export class SavedAddressService {
  constructor(private readonly prisma: PrismaService) {}

  /** Most recently used/edited first. */
  async list(userId: string): Promise<SavedAddressDto[]> {
    const rows = await this.prisma.savedAddress.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map(toDto);
  }

  /**
   * Save a new address. If the customer already has an identical one, that
   * one is bumped to the top instead of creating a duplicate.
   */
  async create(userId: string, addr: OrderAddressSchema): Promise<SavedAddressDto> {
    const data = toData(addr);
    const existing = await this.prisma.savedAddress.findFirst({
      where: {
        userId,
        name: data.name,
        mobileNo: data.mobileNo,
        line1: data.line1,
        line2: data.line2,
        pincode: data.pincode,
      },
    });
    if (existing) {
      const touched = await this.prisma.savedAddress.update({
        where: { id: existing.id },
        data,
      });
      return toDto(touched);
    }

    const created = await this.prisma.savedAddress.create({ data: { userId, ...data } });

    // Keep only the newest MAX_SAVED_ADDRESSES for this customer.
    const overflow = await this.prisma.savedAddress.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      skip: MAX_SAVED_ADDRESSES,
      select: { id: true },
    });
    if (overflow.length) {
      await this.prisma.savedAddress.deleteMany({
        where: { id: { in: overflow.map((o) => o.id) } },
      });
    }
    return toDto(created);
  }

  async update(userId: string, id: string, addr: OrderAddressSchema): Promise<SavedAddressDto> {
    await this.assertOwned(userId, id);
    const updated = await this.prisma.savedAddress.update({ where: { id }, data: toData(addr) });
    return toDto(updated);
  }

  async remove(userId: string, id: string): Promise<{ id: string; deleted: boolean }> {
    await this.assertOwned(userId, id);
    await this.prisma.savedAddress.delete({ where: { id } });
    return { id, deleted: true };
  }

  private async assertOwned(userId: string, id: string) {
    const row = await this.prisma.savedAddress.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!row) throw new NotFoundException('Address not found');
  }
}
