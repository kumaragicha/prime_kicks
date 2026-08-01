import { Body, Controller, Delete, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Roles } from '../auth/decorators/roles.decorator';
import { UploadsService } from './uploads.service';

const MB = 1024 * 1024;
const MAX_IMAGE_BYTES = Number(process.env.MAX_IMAGE_MB ?? 15) * MB;
const MAX_VIDEO_BYTES = Number(process.env.MAX_VIDEO_MB ?? 100) * MB;

@Roles('ADMIN', 'RESELLER')
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post('image')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES } }))
  uploadImage(@UploadedFile() file: Express.Multer.File) {
    return this.uploads.uploadImage(file);
  }

  @Post('video')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_VIDEO_BYTES } }))
  uploadVideo(@UploadedFile() file: Express.Multer.File) {
    return this.uploads.uploadVideo(file);
  }

  @Delete()
  deleteMedia(@Body('url') url?: string) {
    return this.uploads.delete(url);
  }
}
