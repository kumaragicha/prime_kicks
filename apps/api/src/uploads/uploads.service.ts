import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { StorageService } from '../storage/storage.service';

type UploadedFile = {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
};

// WebP quality for photo re-encoding. 80 is visually lossless yet notably
// smaller than a typical JPEG; override with WEBP_QUALITY (1–100) if needed.
const WEBP_QUALITY = Math.min(100, Math.max(1, Number(process.env.WEBP_QUALITY ?? 80)));

const ACCEPTED_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const ACCEPTED_VIDEO = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
} as const;

@Injectable()
export class UploadsService {
  constructor(private readonly storage: StorageService) {}

  /**
   * Validate an uploaded image, re-encode it to optimised WebP (near-lossless,
   * EXIF-stripped, capped dimensions) and store it in R2. Returns the CDN URL.
   */
  async uploadImage(file?: UploadedFile): Promise<{ url: string }> {
    if (!file) throw new BadRequestException('No file uploaded.');
    if (!ACCEPTED_IMAGE_MIME.includes(file.mimetype)) {
      throw new BadRequestException('Only JPG, PNG or WebP images are allowed.');
    }
    if (!isImageMagic(file.buffer)) {
      throw new BadRequestException('File does not look like a valid image.');
    }

    let webp: Buffer;
    try {
      // Normalise once (EXIF rotation + dimension cap), then encode to WebP.
      const base = sharp(file.buffer)
        .rotate() // honour EXIF orientation, then drop metadata
        .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true });

      // quality 80 = visually lossless for photos while compressing well below
      // the source JPEG. effort 6 + smartSubsample squeeze out extra bytes.
      webp = await base
        .clone()
        .webp({ quality: WEBP_QUALITY, effort: 6, smartSubsample: true })
        .toBuffer();

      // Safety net: a heavily pre-compressed source can occasionally grow at
      // q80. If so, re-encode once at a lower quality so we never inflate it.
      if (webp.length >= file.size && WEBP_QUALITY > 65) {
        webp = await base
          .clone()
          .webp({ quality: 65, effort: 6, smartSubsample: true })
          .toBuffer();
      }
    } catch {
      throw new BadRequestException('Could not process this image.');
    }

    const key = `products/images/${randomUUID()}.webp`;
    const url = await this.storage.upload(key, webp, 'image/webp');
    return { url };
  }

  /**
   * Validate an uploaded video (mp4/webm) by magic bytes and store it as-is
   * in R2 behind long-lived CDN caching. Returns the CDN URL.
   */
  async uploadVideo(file?: UploadedFile): Promise<{ url: string }> {
    if (!file) throw new BadRequestException('No file uploaded.');
    const ext = ACCEPTED_VIDEO[file.mimetype as keyof typeof ACCEPTED_VIDEO];
    if (!ext) {
      throw new BadRequestException('Only MP4 or WebM videos are allowed.');
    }
    if (!matchesVideoMagic(file.buffer, ext)) {
      throw new BadRequestException('File does not look like a valid video.');
    }

    const key = `products/videos/${randomUUID()}.${ext}`;
    const url = await this.storage.upload(key, file.buffer, file.mimetype);
    return { url };
  }

  /** Remove a previously-uploaded media object from the bucket by its URL. */
  async delete(url?: string): Promise<{ deleted: boolean }> {
    if (!url || typeof url !== 'string') {
      throw new BadRequestException('A media url is required.');
    }
    const deleted = await this.storage.deleteByUrl(url);
    return { deleted };
  }
}

/** True when the buffer starts with JPEG, PNG or RIFF/WEBP magic bytes. */
function isImageMagic(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return true;
  }
  // WebP: "RIFF" .... "WEBP"
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return true;
  }
  return false;
}

/** Verify the container magic bytes match the declared video type. */
function matchesVideoMagic(buf: Buffer, ext: 'mp4' | 'webm'): boolean {
  if (buf.length < 12) return false;
  if (ext === 'mp4') {
    // ISO-BMFF: bytes 4-8 are the "ftyp" box type.
    return buf.toString('ascii', 4, 8) === 'ftyp';
  }
  // Matroska/WebM EBML header: 1A 45 DF A3
  return buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3;
}
