import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { addressSchema, type OrderAddressSchema } from '@prime-kicks/validation';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AddressService } from './address.service';
import { SavedAddressService } from './saved-address.service';

@Controller('address')
export class AddressController {
  constructor(
    private readonly addressService: AddressService,
    private readonly savedAddress: SavedAddressService,
  ) {}

  @Post('parse')
  parseAddress(@Body() body: { addressBlock: string }) {
    const parsed = this.addressService.parseAddressBlock(body.addressBlock);
    return { parsed };
  }

  /** The caller's saved checkout addresses (most recent first). */
  @Get('saved')
  listSaved(@CurrentUser() user: AuthenticatedUser) {
    return this.savedAddress.list(user.id);
  }

  /** Save a new address for future orders (de-duplicated). */
  @Post('saved')
  createSaved(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(addressSchema)) body: OrderAddressSchema,
  ) {
    return this.savedAddress.create(user.id, body);
  }

  /** Edit one of the caller's saved addresses. */
  @Patch('saved/:id')
  updateSaved(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(addressSchema)) body: OrderAddressSchema,
  ) {
    return this.savedAddress.update(user.id, id, body);
  }

  /** Delete one of the caller's saved addresses. */
  @Delete('saved/:id')
  removeSaved(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.savedAddress.remove(user.id, id);
  }
}
