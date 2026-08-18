import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

/**
 * Logs every HTTP request handled by the API — method, path, status code and
 * elapsed time — plus a full error line when a handler throws. This gives a
 * single, greppable trail across ALL endpoints for debugging (e.g. tracing why
 * an OTP request failed end-to-end: the `POST /api/auth/register/start` line
 * here plus the `[MailService]` lines together tell the whole story).
 *
 * Sensitive fields (passwords, tokens, OTP codes) are never logged — only a
 * redacted set of body keys is emitted so a payload can be correlated without
 * leaking secrets.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  /** Body keys whose values must never be logged. */
  private static readonly SENSITIVE_KEYS = new Set([
    'password',
    'newPassword',
    'currentPassword',
    'passwordHash',
    'code',
    'otp',
    'token',
    'refreshToken',
    'accessToken',
    'tokenHash',
  ]);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const { method, originalUrl } = req;
    const startedAt = Date.now();
    const meta = this.buildMeta(req);

    this.logger.log(`→ ${method} ${originalUrl}${meta}`);

    return next.handle().pipe(
      tap(() => {
        const ms = Date.now() - startedAt;
        this.logger.log(`← ${method} ${originalUrl} ${res.statusCode} (${ms}ms)`);
      }),
      catchError((err: unknown) => {
        const ms = Date.now() - startedAt;
        const status =
          (err as { status?: number })?.status ?? res.statusCode ?? 500;
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `✖ ${method} ${originalUrl} ${status} (${ms}ms) — ${message}`,
          err instanceof Error ? err.stack : undefined,
        );
        return throwError(() => err);
      }),
    );
  }

  /** Build a compact, secret-free suffix describing the request for the log line. */
  private buildMeta(req: Request): string {
    const parts: string[] = [];

    const ip = req.headers['x-forwarded-for'] ?? req.ip;
    if (ip) parts.push(`ip=${Array.isArray(ip) ? ip[0] : ip}`);

    const body = req.body as Record<string, unknown> | undefined;
    if (body && typeof body === 'object' && Object.keys(body).length > 0) {
      const keys = Object.keys(body).map((k) =>
        LoggingInterceptor.SENSITIVE_KEYS.has(k) ? `${k}=***` : k,
      );
      parts.push(`body[${keys.join(',')}]`);
      // Email is safe and highly useful for tracing OTP/auth issues.
      if (typeof body.email === 'string') parts.push(`email=${body.email}`);
    }

    return parts.length ? ` | ${parts.join(' ')}` : '';
  }
}
