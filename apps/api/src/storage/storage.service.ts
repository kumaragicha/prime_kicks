import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

type R2Config = {
  client: S3Client;
  bucket: string;
  publicUrl: string;
};

/**
 * Thin wrapper around an S3-compatible client pointed at Cloudflare R2.
 * Objects are uploaded once under unique keys and served through the public
 * CDN domain (`R2_PUBLIC_URL`), so we can cache them immutably forever.
 *
 * Configuration is resolved lazily on first use: the API still boots when R2
 * env is absent, and only the upload endpoints fail — with a clear message.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private resolved?: R2Config;

  constructor(private readonly config: ConfigService) {}

  private getConfig(): R2Config {
    if (this.resolved) return this.resolved;

    const accountId = this.config.get<string>('R2_ACCOUNT_ID');
    const accessKeyId = this.config.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('R2_SECRET_ACCESS_KEY');
    const bucket = this.config.get<string>('R2_BUCKET');
    const publicUrl = this.config.get<string>('R2_PUBLIC_URL');

    const missing = Object.entries({
      R2_ACCOUNT_ID: accountId,
      R2_ACCESS_KEY_ID: accessKeyId,
      R2_SECRET_ACCESS_KEY: secretAccessKey,
      R2_BUCKET: bucket,
      R2_PUBLIC_URL: publicUrl,
    })
      .filter(([, v]) => !v)
      .map(([k]) => k);

    if (missing.length > 0) {
      throw new ServiceUnavailableException(
        `Media storage is not configured — missing env: ${missing.join(', ')}. ` +
          `Set these in apps/api/.env.`,
      );
    }

    this.resolved = {
      bucket: bucket!,
      publicUrl: publicUrl!.replace(/\/+$/, ''), // strip trailing slashes
      client: new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        forcePathStyle: true,
        credentials: { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! },
      }),
    };
    this.logger.log('Cloudflare R2 storage initialised');
    return this.resolved;
  }

  /**
   * Upload a buffer to R2 under `key` and return its public CDN URL.
   * Uses lib-storage's managed (multipart) upload so larger videos stream
   * without holding the whole body in a single request.
   */
  async upload(key: string, body: Buffer, contentType: string): Promise<string> {
    const { client, bucket, publicUrl } = this.getConfig();
    const upload = new Upload({
      client,
      params: {
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        // Keys are unique (uuid), so the object never changes → cache forever.
        CacheControl: 'public, max-age=31536000, immutable',
      },
    });
    await upload.done();
    return `${publicUrl}/${key}`;
  }

  /**
   * Delete an object given its public CDN URL. Only removes objects that
   * actually live in this bucket under the `products/` prefix — external or
   * legacy URLs are ignored (returns false) rather than erroring.
   */
  async deleteByUrl(url: string): Promise<boolean> {
    const { client, bucket, publicUrl } = this.getConfig();
    const prefix = `${publicUrl}/`;
    if (!url.startsWith(prefix)) return false;

    const key = decodeURIComponent(url.slice(prefix.length));
    // Guard against deleting anything outside our own media namespace.
    if (!key.startsWith('products/')) return false;

    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  }
}
