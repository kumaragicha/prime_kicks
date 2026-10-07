import { Body, Controller, Get, Header, Headers, HttpCode, Post, Query, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { WhatsAppWebhookService } from './whatsapp-webhook.service';

/**
 * Public endpoints Meta calls — no JWT, authenticated instead by the verify
 * token (GET) and the HMAC signature (POST). Reachable at
 * /api/webhook/whatsapp because of the global "api" prefix.
 */
@Controller('webhook/whatsapp')
export class WhatsAppWebhookController {
  constructor(private readonly webhook: WhatsAppWebhookService) {}

  /** One-time handshake when "Verify and save" is clicked in the Meta dashboard. */
  @Public()
  @Get()
  @Header('Content-Type', 'text/plain')
  verify(
    @Query('hub.mode') mode?: string,
    @Query('hub.verify_token') token?: string,
    @Query('hub.challenge') challenge?: string,
  ): string {
    return this.webhook.verifyChallenge(mode, token, challenge);
  }

  /** Event delivery. Needs `rawBody: true` in main.ts so the HMAC covers the exact bytes. */
  @Public()
  @Post()
  @HttpCode(200)
  receive(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Body() body: unknown,
  ): { received: true } {
    this.webhook.assertValidSignature(req.rawBody, signature);
    this.webhook.handle(body);
    return { received: true };
  }
}
