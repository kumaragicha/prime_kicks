import { Body, Controller, Get, Patch } from '@nestjs/common';
import {
  updatePricingSettingSchema,
  updateShipmozoSettingSchema,
  type UpdatePricingSettingSchema,
  type UpdateShipmozoSettingSchema,
} from '@prime-kicks/validation';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Roles('ADMIN')
  @Get('shipmozo')
  getShipmozo() {
    return this.settings.getShipmozo();
  }

  @Roles('ADMIN')
  @Patch('shipmozo')
  updateShipmozo(
    @Body(new ZodValidationPipe(updateShipmozoSettingSchema)) body: UpdateShipmozoSettingSchema,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settings.updateShipmozo(body, user.email);
  }

  // Readable by any authenticated user — the web cart needs the reseller
  // shipping deduction to preview the pickup/label discount.
  @Get('pricing')
  getPricing() {
    return this.settings.getPricing();
  }

  @Roles('ADMIN')
  @Patch('pricing')
  updatePricing(
    @Body(new ZodValidationPipe(updatePricingSettingSchema)) body: UpdatePricingSettingSchema,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settings.updatePricing(body, user.email);
  }
}
