import { Module } from '@nestjs/common';
import { MediaDownloadController, UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  controllers: [UploadsController, MediaDownloadController],
  providers: [UploadsService],
})
export class UploadsModule {}
