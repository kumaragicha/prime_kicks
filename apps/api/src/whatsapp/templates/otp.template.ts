/**
 * Builds the Cloud API payload for an Authentication-category OTP template.
 *
 * Authentication templates are special: Meta owns the wording, so there is no
 * body text to write here. The same 6-digit code is supplied twice —
 *
 *   1. as the single BODY parameter, which fills the `{{1}}` in Meta's fixed copy
 *   2. as the parameter of the copy-code BUTTON, which is what the button copies
 *      to the user's clipboard
 *
 * Both are required. Sending only the body parameter fails with error 132000
 * (parameter count mismatch) because the approved template declares a button.
 *
 * The button component uses `sub_type: "url"` even for a copy-code button —
 * that is Meta's encoding, not a mistake.
 */

export interface OtpTemplateInput {
  /** Recipient in E.164 digits, no leading `+` (e.g. "919876543210"). */
  to: string;
  /** Template name as approved on the WABA (e.g. "prime_kicks_otp"). */
  templateName: string;
  /** Language code of the approved template (e.g. "en" or "en_US"). Must match exactly. */
  languageCode: string;
  /** The 6-digit one-time code. */
  code: string;
}

export function buildOtpTemplateMessage(input: OtpTemplateInput): Record<string, unknown> {
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: input.to,
    type: 'template',
    template: {
      name: input.templateName,
      language: { code: input.languageCode },
      components: [
        {
          type: 'body',
          parameters: [{ type: 'text', text: input.code }],
        },
        {
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [{ type: 'text', text: input.code }],
        },
      ],
    },
  };
}
