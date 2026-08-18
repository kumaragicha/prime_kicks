import type { SendMailInput } from '../mail.service';

/**
 * Builds the subject/text/html for a registration verification email.
 *
 * The HTML mirrors the web store's theme (Prime Kicks): Arial type, ink `#171716`
 * on paper, hairline `#e9e6e1` rules, and the gold accent `#b99255` — the same
 * palette as the on-site OTP panel. Everything is inline-styled with a table
 * layout so it renders consistently across email clients.
 */
export function buildOtpEmail(params: {
  firstName: string;
  code: string;
  expiresMinutes: number;
}): Omit<SendMailInput, 'to'> {
  const { firstName, code, expiresMinutes } = params;

  // Keep the code OUT of the subject — a bare numeric code in the subject line
  // is a well-known spam signal. The code lives in the body instead.
  const subject = 'Verify your Prime Kicks email';

  const text = [
    `Hi ${firstName},`,
    '',
    `Your Prime Kicks verification code is: ${code}`,
    `It expires in ${expiresMinutes} minutes.`,
    '',
    "If you didn't request this, you can safely ignore this email.",
  ].join('\n');

  // Theme tokens (kept in sync with apps/web/app/globals.css @theme)
  const ink = '#171716';
  const paper = '#ffffff';
  const line = '#e9e6e1';
  const accent = '#b99255';
  const accentSoft = '#f5ecdf';
  const muted = '#8a8a86';
  const pageBg = '#efece6';
  const font = 'Arial, Helvetica, sans-serif';

  const html = `
  <style>
    @media only screen and (max-width:480px){
      .pk-pad{padding-left:24px !important;padding-right:24px !important;}
      .pk-h1{font-size:30px !important;}
      .pk-code{font-size:26px !important;letter-spacing:.22em !important;}
    }
  </style>
  <div style="margin:0;padding:28px 10px;background:${pageBg};font-family:${font};color:${ink};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:460px;background:${paper};border:1px solid ${line};border-collapse:collapse;">
          <!-- gold accent rule -->
          <tr><td style="height:3px;background:${accent};line-height:3px;font-size:0;">&nbsp;</td></tr>

          <!-- wordmark -->
          <tr><td class="pk-pad" style="padding:28px 32px 0;">
            <span style="font-size:20px;letter-spacing:-.02em;font-weight:bold;font-style:italic;color:${ink};">PRIME</span><span style="font-size:20px;letter-spacing:.02em;color:${ink};">&nbsp;KICKS</span>
          </td></tr>

          <!-- heading -->
          <tr><td class="pk-pad" style="padding:24px 32px 0;">
            <p style="margin:0 0 10px;font-size:10px;letter-spacing:.16em;text-transform:uppercase;font-weight:bold;color:${ink};">Verify email</p>
            <h1 class="pk-h1" style="margin:0;font-size:34px;line-height:1;letter-spacing:-.04em;color:${ink};font-weight:bold;">Enter code.</h1>
            <p style="margin:16px 0 0;font-size:14px;line-height:1.5;color:${muted};">Hi ${firstName}, use the code below to finish creating your Prime Kicks account.</p>
          </td></tr>

          <!-- code box -->
          <tr><td class="pk-pad" style="padding:22px 32px 0;">
            <div style="background:${accentSoft};border:1px solid ${line};padding:18px 12px;text-align:center;">
              <span class="pk-code" style="font-size:30px;letter-spacing:.3em;font-weight:bold;color:${ink};font-family:${font};">${code}</span>
            </div>
          </td></tr>

          <!-- expiry / disclaimer -->
          <tr><td class="pk-pad" style="padding:16px 32px 32px;">
            <p style="margin:0;font-size:12px;line-height:1.6;color:${muted};">This code expires in ${expiresMinutes} minutes. If you didn't request it, you can safely ignore this email — no account will be created.</p>
          </td></tr>

          <!-- footer -->
          <tr><td class="pk-pad" style="padding:18px 32px;border-top:1px solid ${line};">
            <p style="margin:0;font-size:11px;letter-spacing:.04em;color:${muted};">Prime Kicks — Step into what's next.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </div>`;

  return { subject, text, html };
}
