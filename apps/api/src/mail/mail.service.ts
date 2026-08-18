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
      const secure =
        this.config.get<string>('SMTP_SECURE', 'false') === 'true' || port === 465;
      this.transporter = createTransport({
        host,
        port,
        // Port 465 implies implicit TLS; 587/25 upgrade via STARTTLS.
        secure,
        auth: { user, pass },
      });
      // Log the effective SMTP config (password masked) so a mis-set env var is
      // obvious the moment the API boots.
      this.logger.log(
        `SMTP configured — host=${host} port=${port} secure=${secure} ` +
          `user=${this.maskEmail(user)} from="${this.from}"`,
      );
      // Verify the connection/credentials once at startup and log the outcome.
      // A failure here is the single most common cause of "OTP email not sent".
      this.transporter
        .verify()
        .then(() => this.logger.log('SMTP connection verified — ready to send email'))
        .catch((err: unknown) =>
          this.logger.error(
            `SMTP verification FAILED — emails will not be delivered. ${this.describeError(err)}`,
            err instanceof Error ? err.stack : undefined,
          ),
        );
    } else {
      this.transporter = null;
      const missing = [
        !host && 'SMTP_HOST',
        !user && 'SMTP_USER',
        !pass && 'SMTP_PASS',
      ].filter(Boolean);
      this.logger.warn(
        `SMTP is not configured (missing: ${missing.join(', ')}). ` +
          'Emails will be logged to the console instead of sent.',
      );
    }
  }

  async send({ to, subject, html, text }: SendMailInput): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(
        `[DEV EMAIL — SMTP not configured, not actually sent] To: ${to} | Subject: ${subject}\n${text}`,
      );
      return;
    }

    const startedAt = Date.now();
    this.logger.log(`Sending email → to=${to} subject="${subject}"`);

    try {
      const info = await this.transporter.sendMail({ from: this.from, to, subject, html, text });
      const ms = Date.now() - startedAt;
      // messageId + accepted/rejected + the SMTP server's response line together
      // confirm the provider actually took the message (vs. silently dropping it).
      this.logger.log(
        `Email SENT → to=${to} subject="${subject}" ` +
          `messageId=${info.messageId ?? 'n/a'} ` +
          `accepted=[${(info.accepted ?? []).join(',')}] ` +
          `rejected=[${(info.rejected ?? []).join(',')}] ` +
          `response="${(info.response ?? '').trim()}" (${ms}ms)`,
      );
      if ((info.rejected ?? []).length > 0) {
        this.logger.warn(
          `Email to ${to} was REJECTED by the SMTP server: [${info.rejected.join(',')}]`,
        );
      }
    } catch (err) {
      const ms = Date.now() - startedAt;
      this.logger.error(
        `Email FAILED → to=${to} subject="${subject}" (${ms}ms) — ${this.describeError(err)}`,
        err instanceof Error ? err.stack : undefined,
      );
      throw err;
    }
  }

  /** Extract nodemailer/SMTP error detail (code, command, response) into one line. */
  private describeError(err: unknown): string {
    if (err && typeof err === 'object') {
      const e = err as {
        code?: string;
        command?: string;
        responseCode?: number;
        response?: string;
        message?: string;
      };
      const parts = [
        e.message && `message="${e.message}"`,
        e.code && `code=${e.code}`,
        e.command && `command=${e.command}`,
        e.responseCode && `responseCode=${e.responseCode}`,
        e.response && `response="${String(e.response).trim()}"`,
      ].filter(Boolean);
      if (parts.length) return parts.join(' ');
    }
    return err instanceof Error ? err.message : String(err);
  }

  /** Mask the local part of an email/username for safe logging (e.g. jo***@x.com). */
  private maskEmail(value: string): string {
    const at = value.indexOf('@');
    if (at <= 0) return value.length > 2 ? `${value.slice(0, 2)}***` : '***';
    const local = value.slice(0, at);
    const domain = value.slice(at);
    const shown = local.slice(0, Math.min(2, local.length));
    return `${shown}***${domain}`;
  }
}
