import { Module } from '@nestjs/common';
import { DimensionsModule } from '../dimensions/dimensions.module';
import { SettingsModule } from '../settings/settings.module';
import { ShipmentService } from './shipment.service';
import { ShipmozoController } from './shipmozo.controller';
import { ShipmozoService } from './shipmozo.service';

@Module({
  imports: [SettingsModule, DimensionsModule],
  controllers: [ShipmozoController],
  providers: [ShipmozoService, ShipmentService],
  exports: [ShipmentService, ShipmozoService],
})
export class ShipmozoModule {}
