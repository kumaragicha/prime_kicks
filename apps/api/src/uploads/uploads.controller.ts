import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
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

/**
 * Public media-download proxy, in its own controller so it doesn't inherit
 * UploadsController's class-level roles. The storefront links here to force a
 * browser download of CDN media (the CDN itself has no CORS/attachment
 * headers, so a direct link just opens in a tab).
 */
@Public()
@Controller('uploads')
export class MediaDownloadController {
  constructor(private readonly uploads: UploadsService) {}

  @Get('download')
  async download(@Query('url') url: string | undefined, @Res({ passthrough: true }) res: Response) {
    const { body, contentType, contentLength } = await this.uploads.download(url);
    // The key is products/<subdir>/<uuid>.<ext>; its basename is already a
    // safe header value (uuid + extension, no quotes/controls).
    const filename = url!.split(/[?#]/)[0]!.split('/').pop() || 'download';
    res.setHeader('Content-Type', contentType ?? 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    if (contentLength) res.setHeader('Content-Length', String(contentLength));
    res.setHeader('Cache-Control', 'no-store');
    return new StreamableFile(body);
  }
}
