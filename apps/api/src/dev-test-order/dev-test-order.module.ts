import { Module } from '@nestjs/common';
import { AddressModule } from '../address/address.module';
import { CourierConfigModule } from '../courier-config/courier-config.module';
import { DimensionsModule } from '../dimensions/dimensions.module';
import { ShipmozoModule } from '../shipmozo/shipmozo.module';
import { DevTestOrderController } from './dev-test-order.controller';

/** Dev-only wiring: a public, non-production endpoint that reuses the existing
 *  address parser, Shipmozo client and courier-config priority list to push a
 *  throwaway order from a pasted address + chosen weight and assign a courier.
 *  Adds no new integration code. */
@Module({
  imports: [AddressModule, ShipmozoModule, CourierConfigModule, DimensionsModule],
  controllers: [DevTestOrderController],
})
export class DevTestOrderModule {}
