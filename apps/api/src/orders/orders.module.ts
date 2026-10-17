import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { ShipmozoModule } from '../shipmozo/shipmozo.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [ShipmozoModule, SettingsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  // PaymentsModule reuses approve() to confirm a verified Razorpay payment —
  // the same transition an admin triggers manually for a COD order.
  exports: [OrdersService],
})
export class OrdersModule {}
