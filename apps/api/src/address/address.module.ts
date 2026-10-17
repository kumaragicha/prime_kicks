import { Module } from '@nestjs/common';
import { AddressController } from './address.controller';
import { AddressService } from './address.service';
import { SavedAddressService } from './saved-address.service';

@Module({
  controllers: [AddressController],
  providers: [AddressService, SavedAddressService],
  exports: [AddressService],
})
export class AddressModule {}
