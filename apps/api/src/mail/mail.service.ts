import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Thin wrapper over nodemailer. Configured entirely from SMTP_* env vars so any
 * free provider works (Gmail app password, Brevo, Zoho, Mailgun SMTP, …).
 *
 * When SMTP is not configured we fall back to logging the message to the server
 * console instead of throwing — this keeps local development (and the OTP flow)
 * fully working with zero setup.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    this.from = this.config.get<string>('MAIL_FROM', 'Prime Kicks <no-reply@primekicks.local>');

    const host = this.config.get<string>('SMTP_HOST');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');

    if (host && user && pass) {
      const port = Number(this.config.get<string>('SMTP_PORT', '587'));
      this.transporter = createTransport({
        host,
        port,
        // Port 465 implies implicit TLS; 587/25 upgrade via STARTTLS.
        secure: this.config.get<string>('SMTP_SECURE', 'false') === 'true' || port === 465,
        auth: { user, pass },
      });
    } else {
      this.transporter = null;
      this.logger.warn(
        'SMTP is not configured (SMTP_HOST/SMTP_USER/SMTP_PASS missing). ' +
          'Emails will be logged to the console instead of sent.',
      );
    }
  }

  async send({ to, subject, html, text }: SendMailInput): Promise<void> {
    if (!this.transporter) {
      this.logger.log(
        `[DEV EMAIL] To: ${to} | Subject: ${subject}\n${text}`,
      );
      return;
    }

    try {
      await this.transporter.sendMail({ from: this.from, to, subject, html, text });
    } catch (err) {
      this.logger.error(`Failed to send email to ${to}`, err as Error);
      throw err;
    }
  }
}
