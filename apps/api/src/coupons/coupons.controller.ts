import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import type {
  ApplyCouponSchema,
  CouponQuerySchema,
  CreateCouponSchema,
  UpdateCouponSchema,
} from '@prime-kicks/validation';
import {
  applyCouponSchema,
  couponQuerySchema,
  createCouponSchema,
  updateCouponSchema,
} from '@prime-kicks/validation';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CouponsService } from './coupons.service';

@Controller('coupons')
export class CouponsController {
  constructor(private readonly coupons: CouponsService) {}

  /** Admin: list/search coupons. */
  @Roles('ADMIN')
  @Get()
  list(@Query(new ZodValidationPipe(couponQuerySchema)) query: CouponQuerySchema) {
    return this.coupons.list(query);
  }

  /** Admin: create a coupon. */
  @Roles('ADMIN')
  @Post()
  create(@Body(new ZodValidationPipe(createCouponSchema)) body: CreateCouponSchema) {
    return this.coupons.create(body);
  }

  /**
   * Storefront: preview/validate a coupon against the caller's cart before
   * paying. Authenticated; customer-only eligibility is enforced in the service
   * (a reseller gets a clear "customers only" message).
   */
  @Post('validate')
  validate(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(applyCouponSchema)) body: ApplyCouponSchema,
  ) {
    return this.coupons.preview(user.id, body);
  }

  /** Admin: update a coupon. */
  @Roles('ADMIN')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCouponSchema)) body: UpdateCouponSchema,
  ) {
    return this.coupons.update(id, body);
  }

  /** Admin: delete a coupon. */
  @Roles('ADMIN')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.coupons.remove(id);
  }
}
