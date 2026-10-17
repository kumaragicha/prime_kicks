import { Module } from '@nestjs/common';
import { CouponsController } from './coupons.controller';
import { CouponsService } from './coupons.service';

@Module({
  controllers: [CouponsController],
  providers: [CouponsService],
  // OrdersModule applies coupons during checkout pricing/creation.
  exports: [CouponsService],
})
export class CouponsModule {}
