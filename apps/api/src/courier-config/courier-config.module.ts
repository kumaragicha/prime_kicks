import { Module } from '@nestjs/common';
import { CourierConfigService } from './courier-config.service';
import { CourierConfigController } from './courier-config.controller';

@Module({
  controllers: [CourierConfigController],
  providers: [CourierConfigService],
  exports: [CourierConfigService],
})
export class CourierConfigModule {}
