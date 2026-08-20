import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { ShipmozoModule } from '../shipmozo/shipmozo.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [ShipmozoModule, SettingsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
