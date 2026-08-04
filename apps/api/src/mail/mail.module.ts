import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';

/**
 * Global so any feature (auth OTP today, order receipts later) can inject
 * MailService without re-importing this module.
 */
@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
