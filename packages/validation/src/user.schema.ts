import { z } from 'zod';

export const userRoleSchema = z.enum(['CUSTOMER', 'RESELLER', 'ADMIN']);

/** E.164-ish: optional leading +, 7–15 digits. */
const mobileNoSchema = z
  .string()
  .regex(/^\+?[1-9]\d{6,14}$/, 'Enter a valid mobile number');

/**
 * A person's name: letters and spaces only — no digits, apostrophes, hyphens or
 * other special characters. `label` personalises the messages.
 *
 * Combining marks (\p{M}) are allowed alongside letters because Indic scripts
 * build characters from them: "रीता" is र + ी + त + ा, where the vowel signs are
 * marks, not letters. Matching \p{L} alone silently rejects most Hindi, Tamil,
 * Bengali and Gujarati names.
 */
const nameSchema = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    // Capped so a pathological value can't be persisted or rendered. 80 is well
    // past the longest real names while staying far short of abuse.
    .max(80, `${label} must be 80 characters or fewer`)
    .regex(/^[\p{L}\p{M} ]+$/u, `${label} can only contain letters and spaces`);

/**
 * Legacy full registration (email + password). Still used by the admin-side
 * user create; the storefront now uses the mobile OTP flow above.
 */
export const registerSchema = z.object({
  firstName: nameSchema('First name'),
  lastName: nameSchema('Last name'),
  email: z.string().email(),
  mobileNo: mobileNoSchema,
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: userRoleSchema.default('CUSTOMER'),
});

/** Login accepts either an email address or a mobile number as the identifier. */
export const loginSchema = z.object({
  identifier: z.string().min(1, 'Enter your email or mobile number'),
  password: z.string().min(8),
});

/** A 6-digit numeric one-time code. */
const otpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'Enter the 6-digit code');

/**
 * A number the OTP flow can actually deliver to.
 *
 * Stricter than `mobileNoSchema` (which allows 7–15 digits for legacy/admin
 * records): a code must reach a real handset, so we require either a national
 * 10-digit number or an explicit country code. Without this a mistyped 9-digit
 * number is accepted, a code is sent nowhere, and the visitor is left waiting.
 */
const otpMobileSchema = z
  .string()
  .trim()
  .regex(
    /^(?:\+[1-9]\d{9,14}|0?[1-9]\d{9})$/,
    'Enter a valid 10-digit mobile number, or include the country code',
  );

/**
 * Step 1 of the storefront auth flow: ask for a WhatsApp code.
 *
 * The same call serves sign-up and login — the server replies with `isNewUser`
 * so the client knows whether to collect a name before verifying.
 */
export const otpStartSchema = z.object({
  mobileNo: otpMobileSchema,
});

/**
 * Step 2: confirm the code.
 *
 * `name` is required only for a number with no account yet; for an existing
 * account it is ignored. The server re-checks this, so omitting it for a new
 * number fails there rather than silently creating a nameless account.
 */
export const otpVerifySchema = z.object({
  mobileNo: otpMobileSchema,
  code: otpCodeSchema,
  name: nameSchema('Name').optional(),
});

/** Ask for a fresh code, subject to the resend cooldown. */
export const otpResendSchema = z.object({
  mobileNo: otpMobileSchema,
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'refreshToken is required'),
});

/** Request a password-reset link by email. */
export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

/** Complete a password reset with the token from the emailed link. */
export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const updateUserSchema = registerSchema
  .omit({ password: true, role: true })
  .partial();

export const userStatusSchema = z.enum(['active', 'disabled']);

export const userQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  role: userRoleSchema.optional(),
  status: userStatusSchema.optional(),
});

export type RegisterSchema = z.infer<typeof registerSchema>;
export type OtpStartSchema = z.infer<typeof otpStartSchema>;
export type OtpVerifySchema = z.infer<typeof otpVerifySchema>;
export type OtpResendSchema = z.infer<typeof otpResendSchema>;
export type LoginSchema = z.infer<typeof loginSchema>;
export type RefreshSchema = z.infer<typeof refreshSchema>;
export type ForgotPasswordSchema = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordSchema = z.infer<typeof resetPasswordSchema>;
export type UpdateUserSchema = z.infer<typeof updateUserSchema>;
export type UserQuerySchema = z.infer<typeof userQuerySchema>;
