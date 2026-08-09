import { Module } from '@nestjs/common';
import { CombinationsController } from './combinations.controller';
import { CombinationsService } from './combinations.service';
import { DimensionsController } from './dimensions.controller';
import { DimensionsService } from './dimensions.service';

@Module({
  controllers: [DimensionsController, CombinationsController],
  providers: [DimensionsService, CombinationsService],
  exports: [DimensionsService, CombinationsService],
})
export class DimensionsModule {}
