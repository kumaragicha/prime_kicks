import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { UserQuerySchema } from '@prime-kicks/validation';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Fields safe to expose to the admin UI (never the password/refresh hashes). */
const userSelect = {
  id: true,
  firstName: true,
  lastName: true,
  name: true,
  email: true,
  mobileNo: true,
  city: true,
  state: true,
  role: true,
  isActive: true,
  isEmailVerified: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: UserQuerySchema) {
    const { page, pageSize, search, role, status } = query;

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(role ? { role } : {}),
      ...(status ? { isActive: status === 'active' } : {}),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { mobileNo: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: userSelect,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: userSelect,
    });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }

  /** Enable or disable a user. Disabling also revokes their refresh token. */
  async setActive(id: string, isActive: boolean, actorId?: string) {
    await this.findOne(id);
    if (actorId && id === actorId) {
      throw new BadRequestException('You cannot disable your own account');
    }
    return this.prisma.user.update({
      where: { id },
      data: { isActive, ...(isActive ? {} : { refreshTokenHash: null }) },
      select: userSelect,
    });
  }

  /** Convert a CUSTOMER account to a RESELLER. */
  async makeReseller(id: string) {
    const user = await this.findOne(id);
    if (user.role === 'RESELLER') {
      throw new BadRequestException('User is already a reseller');
    }
    if (user.role === 'ADMIN') {
      throw new BadRequestException('Cannot convert an admin account to a reseller');
    }
    return this.prisma.user.update({
      where: { id },
      data: { role: 'RESELLER' },
      select: userSelect,
    });
  }

  /** Permanently delete the user record. */
  async remove(id: string, actorId?: string) {
    await this.findOne(id);
    if (actorId && id === actorId) {
      throw new BadRequestException('You cannot delete your own account');
    }
    try {
      await this.prisma.user.delete({ where: { id } });
      return { id, deleted: true };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new ConflictException('Cannot delete a user that has orders');
      }
      throw error;
    }
  }
}
