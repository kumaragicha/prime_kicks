import { Body, Controller, Post } from '@nestjs/common';
import { AddressService } from './address.service';

@Controller('address')
export class AddressController {
  constructor(private readonly addressService: AddressService) {}

  @Post('parse')
  parseAddress(@Body() body: { addressBlock: string }) {
    const parsed = this.addressService.parseAddressBlock(body.addressBlock);
    return { parsed };
  }
}
