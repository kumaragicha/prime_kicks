import { Global, Module } from '@nestjs/common';
import { WhatsAppWebhookController } from './whatsapp-webhook.controller';
import { WhatsAppWebhookService } from './whatsapp-webhook.service';
import { WhatsAppService } from './whatsapp.service';

/**
 * Global so any feature (auth OTP today, order/shipping notifications later) can
 * inject WhatsAppService without re-importing this module — mirrors MailModule.
 * Also hosts Meta's webhook (delivery receipts / status alerts).
 */
@Global()
@Module({
  controllers: [WhatsAppWebhookController],
  providers: [WhatsAppService, WhatsAppWebhookService],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
