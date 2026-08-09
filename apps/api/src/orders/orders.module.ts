import { Module } from '@nestjs/common';
import { ShipmozoModule } from '../shipmozo/shipmozo.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [ShipmozoModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
