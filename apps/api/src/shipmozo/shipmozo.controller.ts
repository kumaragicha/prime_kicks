import { BadRequestException, Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  attachShipmozoOrderSchema,
  manualShipmentSchema,
  type AttachShipmozoOrderSchema,
  type ManualShipmentSchema,
} from '@prime-kicks/validation';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ShipmentService } from './shipment.service';

@Controller('shipmozo')
export class ShipmozoController {
  constructor(private readonly shipment: ShipmentService) {}

  /** Health check against the Shipmozo API (admin only). */
  @Roles('ADMIN')
  @Get('info')
  info() {
    return this.shipment.info();
  }

  /** Check delivery serviceability to a pincode from the configured warehouse (admin only). */
  @Roles('ADMIN')
  @Get('serviceability/:pincode')
  serviceability(@Param('pincode') pincode: string) {
    const digits = pincode.replace(/\D/g, '');
    if (!digits) throw new BadRequestException('A valid delivery pincode is required.');
    return this.shipment.checkServiceability(Number(digits));
  }

  /** (Re)push an order to the Shipmozo panel (admin only) — a deliberate retry,
   *  so it forces past the idempotency guard. */
  @Roles('ADMIN')
  @Post('orders/:id/push')
  push(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.shipment.pushForOrder(id, user.email, true);
  }

  /** Manually mark an order as shipped with a local courier + AWB (admin only). */
  @Roles('ADMIN')
  @Post('orders/:id/manual-ship')
  manualShip(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(manualShipmentSchema)) body: ManualShipmentSchema,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.shipment.markManualShipment(id, body.courierPartner, body.trackingId, user.email);
  }

  /** Attach an existing Shipmozo order by id — validates it, then marks shipped (admin only). */
  @Roles('ADMIN')
  @Post('orders/:id/attach-shipmozo')
  attachShipmozo(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(attachShipmozoOrderSchema)) body: AttachShipmozoOrderSchema,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.shipment.attachShipmozoOrder(id, body.shipmozoOrderId, user.email);
  }

  /** Drop a shipment — revert to not shipped and clear all tracking (admin only). */
  @Roles('ADMIN')
  @Post('orders/:id/drop')
  dropShipment(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.shipment.dropShipment(id, user.email);
  }
}
