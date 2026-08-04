import type { SendMailInput } from '../mail.service';

/**
 * Builds the subject/text/html for a password-reset email. Themed to match the
 * Prime Kicks store (and the OTP email): ink `#171716` on paper, hairline rules,
 * gold accent `#b99255`, inline table layout for cross-client consistency.
 */
export function buildPasswordResetEmail(params: {
  firstName: string;
  resetUrl: string;
  expiresMinutes: number;
}): Omit<SendMailInput, 'to'> {
  const { firstName, resetUrl, expiresMinutes } = params;

  const subject = 'Reset your Prime Kicks password';

  const text = [
    `Hi ${firstName},`,
    '',
    'We received a request to reset your Prime Kicks password.',
    'Open the link below to choose a new one:',
    resetUrl,
    '',
    `This link expires in ${expiresMinutes} minutes and can be used once.`,
    "If you didn't request this, you can safely ignore this email — your password won't change.",
  ].join('\n');

  const ink = '#171716';
  const paper = '#ffffff';
  const line = '#e9e6e1';
  const accent = '#b99255';
  const muted = '#8a8a86';
  const pageBg = '#efece6';
  const font = 'Arial, Helvetica, sans-serif';

  const html = `
  <div style="margin:0;padding:32px 12px;background:${pageBg};font-family:${font};color:${ink};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <tr><td align="center">
        <table role="presentation" width="460" cellpadding="0" cellspacing="0" style="width:460px;max-width:100%;background:${paper};border:1px solid ${line};border-collapse:collapse;">
          <tr><td style="height:3px;background:${accent};line-height:3px;font-size:0;">&nbsp;</td></tr>

          <tr><td style="padding:30px 44px 0;">
            <span style="font-size:20px;letter-spacing:-.02em;font-weight:bold;font-style:italic;color:${ink};">PRIME</span><span style="font-size:20px;letter-spacing:.02em;color:${ink};">&nbsp;KICKS</span>
          </td></tr>

          <tr><td style="padding:26px 44px 0;">
            <p style="margin:0 0 10px;font-size:10px;letter-spacing:.16em;text-transform:uppercase;font-weight:bold;color:${ink};">Password reset</p>
            <h1 style="margin:0;font-size:40px;line-height:.98;letter-spacing:-.04em;color:${ink};font-weight:bold;">Set a new one.</h1>
            <p style="margin:16px 0 0;font-size:14px;line-height:1.5;color:${muted};">Hi ${firstName}, we got a request to reset your password. Tap the button below to choose a new one.</p>
          </td></tr>

          <tr><td style="padding:24px 44px 0;">
            <a href="${resetUrl}" style="display:inline-block;background:${ink};color:#ffffff;text-decoration:none;font-size:11px;font-weight:bold;letter-spacing:.1em;text-transform:uppercase;padding:15px 22px;">Reset password &nbsp;&rarr;</a>
          </td></tr>

          <tr><td style="padding:18px 44px 0;">
            <p style="margin:0;font-size:12px;line-height:1.6;color:${muted};">Or paste this link into your browser:</p>
            <p style="margin:6px 0 0;font-size:12px;line-height:1.6;word-break:break-all;"><a href="${resetUrl}" style="color:${accent};">${resetUrl}</a></p>
          </td></tr>

          <tr><td style="padding:16px 44px 34px;">
            <p style="margin:0;font-size:12px;line-height:1.6;color:${muted};">This link expires in ${expiresMinutes} minutes and can be used once. If you didn't request a reset, you can safely ignore this email — your password won't change.</p>
          </td></tr>

          <tr><td style="padding:18px 44px;border-top:1px solid ${line};">
            <p style="margin:0;font-size:11px;letter-spacing:.04em;color:${muted};">Prime Kicks — Step into what's next.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </div>`;

  return { subject, text, html };
}
