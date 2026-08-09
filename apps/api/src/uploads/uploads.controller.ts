import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { ACCEPTED_IMAGE_MIME, ACCEPTED_VIDEO_MIME, UploadsService } from './uploads.service';

const MB = 1024 * 1024;
const MAX_IMAGE_BYTES = Number(process.env.MAX_IMAGE_MB ?? 15) * MB;
const MAX_VIDEO_BYTES = Number(process.env.MAX_VIDEO_MB ?? 100) * MB;

/**
 * Reject a file by its declared MIME *before* multer buffers it into memory —
 * a wrong-type upload is refused at the first byte instead of after the whole
 * (up to 100 MB) body is read.
 */
function mimeFilter(accepted: readonly string[]) {
  return (
    _req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, accept: boolean) => void,
  ) => {
    if (accepted.includes(file.mimetype)) return cb(null, true);
    cb(new BadRequestException(`Unsupported file type: ${file.mimetype}`), false);
  };
}

@Roles('ADMIN', 'RESELLER')
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_IMAGE_BYTES },
      fileFilter: mimeFilter(ACCEPTED_IMAGE_MIME),
    }),
  )
  uploadImage(@UploadedFile() file: Express.Multer.File) {
    return this.uploads.uploadImage(file);
  }

  @Post('video')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_VIDEO_BYTES },
      fileFilter: mimeFilter(ACCEPTED_VIDEO_MIME),
    }),
  )
  uploadVideo(@UploadedFile() file: Express.Multer.File) {
    return this.uploads.uploadVideo(file);
  }

  @Delete()
  deleteMedia(@Body('url') url?: string) {
    return this.uploads.delete(url);
  }
}
