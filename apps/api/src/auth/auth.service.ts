import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type {
  LoginSchema,
  OtpVerifySchema,
  RegisterSchema,
} from '@prime-kicks/validation';
import {
  AuditEvent,
  AuditModule,
  Prisma,
  type User,
  type UserRole,
} from '@prisma/client';
import { compare, hash } from 'bcryptjs';
import { createHash, randomBytes, randomInt } from 'node:crypto';
import { AuditLogService } from '../audit-log/audit-log.service';
import type { Storefront } from '../common/storefront';
import { MailService } from '../mail/mail.service';
import { buildPasswordResetEmail } from '../mail/templates/password-reset.template';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppSendError } from '../whatsapp/whatsapp.error';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import type { JwtPayload } from './auth.types';

const SALT_ROUNDS = 10;

/**
 * A pre-computed bcrypt hash compared against when a login email is unknown, so
 * a failed login takes the same time whether or not the account exists — closing
 * the user-enumeration timing oracle. (No real password ever produces it.)
 */
const DUMMY_PASSWORD_HASH = '$2a$10$RCurgRADPFnitP7XH5QEpeMLWdnPeQo8i6LnpI2m.TOJCKyaazcwm';

/** How long a WhatsApp OTP stays valid, in minutes. */
const OTP_EXP_MINUTES_DEFAULT = 10;
/** Wrong-code submissions allowed before the pending signup must request a new code. */
const OTP_MAX_ATTEMPTS = 5;
/** Minimum seconds between OTP (re)send requests for the same signup. */
const OTP_RESEND_COOLDOWN_SECONDS = 60;

/** How long a password-reset link stays valid, in minutes. */
const PASSWORD_RESET_EXP_MINUTES = 30;

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Parse a zeit/ms-style duration ("15m", "7d", "12h", "30s", or plain seconds)
 * into milliseconds, used to stamp a refresh session's DB expiry so it mirrors
 * the JWT's own `expiresIn`. Falls back to `fallbackMs` for anything unparseable.
 */
function parseDurationMs(value: string, fallbackMs: number): number {
  const match = /^(\d+)\s*([smhd])?$/.exec(value.trim());
  if (!match) return fallbackMs;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return fallbackMs;
  const unitMs: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  // No unit → treat as seconds (jsonwebtoken's default for a bare number).
  const unit = match[2];
  const multiplier = unit ? (unitMs[unit] ?? 1000) : 1000;
  return amount * multiplier;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
    private readonly whatsapp: WhatsAppService,
    private readonly audit: AuditLogService,
  ) {}

  /** Record a new-account creation in the audit trail (audited by the user themselves). */
  private auditUserCreated(user: User, via: string): void {
    this.audit.log({
      module: AuditModule.AUTH,
      event: AuditEvent.CREATION,
      moduleId: user.id,
      referenceNumber: user.email,
      subModule: via,
      action: `Account "${user.email}" registered (${via})`,
      formData: { id: user.id, email: user.email, role: user.role },
      auditedBy: user.email,
    });
  }

  // ── Mobile OTP: sign-up AND login ───────────────────────────────────────
  // One flow serves both. A storefront visitor enters a mobile number; we send a
  // WhatsApp code; they enter it back. If the number already has an account they
  // are signed in, otherwise an account is created from the name they supplied.
  //
  //   1) `startOtp`  — store the hashed code against the number, send it, and
  //                    tell the client whether this number is new (so it knows
  //                    to ask for a name before step 2).
  //   2) `verifyOtp` — check the code, then sign in or create + sign in.
  //   3) `resendOtp` — a fresh code, subject to the cooldown.
  //
  // No password is involved anywhere here. Password login (`login`) still exists
  // for ADMIN accounts and predates this flow.

  /**
   * Decide a new account's role from the storefront it signed up on — NEVER from
   * the request body.
   *
   *   reseller storefront → RESELLER (no admin approval step — that is the point
   *                         of the private reseller domain)
   *   public storefront   → CUSTOMER
   *
   * ADMIN accounts are never self-service; they are created by seeding or
   * promoted by an existing admin via UsersService.
   */
  private roleForStorefront(storefront: Storefront): UserRole {
    return storefront === 'reseller' ? 'RESELLER' : 'CUSTOMER';
  }

  /**
   * Canonical storage/lookup form for a mobile number: E.164 with a leading `+`.
   *
   * Visitors type the same number many ways ("9876543210", "+91 98765 43210",
   * "09876543210"). Without one canonical form the same person would get several
   * accounts, and the unique constraint on mobileNo would not catch it.
   *
   * A bare 10-digit number is assumed to be in OTP_DEFAULT_COUNTRY_CODE; a number
   * that already carries a country code is left alone rather than "corrected",
   * since guessing wrong would send someone else's code.
   */
  private normalizeMobile(input: string): string {
    const digits = input.replace(/\D/g, '');
    const trimmed = digits.length === 11 && digits.startsWith('0') ? digits.slice(1) : digits;
    const cc = this.config.get<string>('WHATSAPP_DEFAULT_COUNTRY_CODE', '91');
    return `+${trimmed.length === 10 ? `${cc}${trimmed}` : trimmed}`;
  }

  /**
   * Find an account by mobile number, tolerating however it was stored.
   *
   * Rows created before normalization existed may hold "9876543210" or
   * "919876543210" rather than "+919876543210", so all three spellings are
   * tried. New rows are always written in canonical form.
   */
  private async findUserByMobile(canonical: string): Promise<User | null> {
    const withoutPlus = canonical.slice(1);
    const cc = this.config.get<string>('WHATSAPP_DEFAULT_COUNTRY_CODE', '91');
    const national = withoutPlus.startsWith(cc) ? withoutPlus.slice(cc.length) : null;

    return this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        mobileNo: { in: [canonical, withoutPlus, ...(national ? [national] : [])] },
      },
    });
  }

  /** Split the single name field into the first/last columns the admin UI reads. */
  private splitName(name: string): { firstName: string; lastName: string | null } {
    const parts = name.trim().split(/\s+/);
    const firstName = parts[0] ?? name.trim();
    const lastName = parts.length > 1 ? parts.slice(1).join(' ') : null;
    return { firstName, lastName };
  }

  /**
   * Step 1: send a WhatsApp code to a mobile number.
   *
   * Deliberately reveals whether the number already has an account (`isNewUser`),
   * because the client must know whether to ask for a name. That is a mild
   * enumeration oracle, and an accepted one: a storefront that asks every visitor
   * for their name on every login is worse, and the same fact is observable from
   * the sign-in screen of essentially every OTP-based app.
   */
  async startOtp(mobileNo: string) {
    const canonical = this.normalizeMobile(mobileNo);
    const masked = this.maskMobile(canonical);
    const existing = await this.findUserByMobile(canonical);

    if (existing && !existing.isActive) {
      this.logger.warn(`OTP refused for disabled account ${masked}`);
      throw new UnauthorizedException('This account is disabled.');
    }

    // Throttle before sending: an un-cooled request must not cost us a message.
    const live = await this.prisma.mobileOtp.findUnique({ where: { mobileNo: canonical } });
    if (live) this.assertResendAllowed(live.lastSentAt);

    const code = this.generateOtp();
    await this.prisma.mobileOtp.upsert({
      where: { mobileNo: canonical },
      create: { mobileNo: canonical, codeHash: this.digest(code), expiresAt: this.otpExpiry() },
      update: {
        codeHash: this.digest(code),
        expiresAt: this.otpExpiry(),
        attempts: 0,
        lastSentAt: new Date(),
      },
    });

    this.logger.log(
      `OTP requested for ${masked} (isNewUser=${!existing})`,
    );

    // A failed send leaves a code nobody can use AND a cooldown the visitor did
    // not benefit from — drop the row so they can retry immediately.
    try {
      await this.sendOtpWhatsApp(canonical, code);
    } catch (error) {
      await this.prisma.mobileOtp.delete({ where: { mobileNo: canonical } }).catch(() => undefined);
      throw this.otpDeliveryFailure(error);
    }

    return {
      mobileNo: masked,
      isNewUser: !existing,
      expiresInMinutes: this.otpExpMinutes(),
    };
  }

  /**
   * Step 2: confirm the code, then sign in — creating the account first if this
   * number is new.
   *
   * The code is consumed on success and on every terminal failure (expiry,
   * attempt cap), so a code can never be replayed.
   */
  async verifyOtp(input: OtpVerifySchema, storefront: Storefront = 'web') {
    const canonical = this.normalizeMobile(input.mobileNo);
    const masked = this.maskMobile(canonical);
    this.logger.log(`Verifying OTP for ${masked}`);

    const record = await this.prisma.mobileOtp.findUnique({ where: { mobileNo: canonical } });
    if (!record) {
      this.logger.warn(`OTP verify rejected — no live code for ${masked}`);
      throw new BadRequestException('No code was requested for this number. Please start again.');
    }

    if (record.expiresAt.getTime() < Date.now()) {
      this.logger.warn(`OTP verify rejected — code expired for ${masked}`);
      await this.prisma.mobileOtp.delete({ where: { id: record.id } });
      throw new BadRequestException('This code has expired. Please request a new one.');
    }

    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      this.logger.warn(`OTP verify rejected — attempt cap reached for ${masked}`);
      await this.prisma.mobileOtp.delete({ where: { id: record.id } });
      throw new BadRequestException('Too many incorrect attempts. Please request a new code.');
    }

    if (this.digest(input.code) !== record.codeHash) {
      const used = record.attempts + 1;
      this.logger.warn(`OTP verify rejected — wrong code for ${masked} (${used}/${OTP_MAX_ATTEMPTS})`);
      await this.prisma.mobileOtp.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException('Incorrect code. Please try again.');
    }

    const existing = await this.findUserByMobile(canonical);

    if (existing) {
      if (!existing.isActive) throw new UnauthorizedException('This account is disabled.');
      await this.prisma.mobileOtp.delete({ where: { id: record.id } });
      this.logger.log(`OTP login for existing account ${masked}`);
      return this.issueTokens(existing, { lastLoginAt: new Date() });
    }

    // New number — the client should have collected a name at step 1, where we
    // told it isNewUser. Re-checked here because the client cannot be trusted.
    if (!input.name?.trim()) {
      this.logger.warn(`OTP verify rejected — name missing for new account ${masked}`);
      throw new BadRequestException('Please tell us your name to finish creating your account.');
    }

    const user = await this.createOtpUser(canonical, input.name.trim(), storefront);
    await this.prisma.mobileOtp.delete({ where: { id: record.id } }).catch(() => undefined);

    this.auditUserCreated(user, `otp-signup:${storefront}`);
    this.logger.log(`OTP signup created account ${masked} role=${user.role}`);
    return this.issueTokens(user, { lastLoginAt: new Date() });
  }

  /**
   * Create an account from a name and a verified mobile number.
   *
   * email / passwordHash / city / state stay null: the storefront never collects
   * them, and the address captured at checkout carries the delivery details.
   */
  private async createOtpUser(
    canonicalMobile: string,
    name: string,
    storefront: Storefront,
  ): Promise<User> {
    const { firstName, lastName } = this.splitName(name);
    try {
      return await this.prisma.user.create({
        data: {
          firstName,
          lastName,
          name,
          mobileNo: canonicalMobile,
          role: this.roleForStorefront(storefront),
          // The mobile number was just proven by the OTP.
          isEmailVerified: true,
        },
      });
    } catch (error) {
      // The number was claimed between the lookup and the insert.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('This mobile number is already registered.');
      }
      throw error;
    }
  }

  /** Step 3: re-send a fresh code for a number, subject to the cooldown. */
  async resendOtp(mobileNo: string) {
    const canonical = this.normalizeMobile(mobileNo);
    const record = await this.prisma.mobileOtp.findUnique({ where: { mobileNo: canonical } });
    if (!record) {
      throw new BadRequestException('No code was requested for this number. Please start again.');
    }

    this.assertResendAllowed(record.lastSentAt);

    const code = this.generateOtp();
    const previousSentAt = record.lastSentAt;
    await this.prisma.mobileOtp.update({
      where: { id: record.id },
      data: {
        codeHash: this.digest(code),
        expiresAt: this.otpExpiry(),
        attempts: 0,
        lastSentAt: new Date(),
      },
    });

    // Roll the cooldown back if we could not actually deliver — the visitor
    // should not be penalised for our delivery failure.
    try {
      await this.sendOtpWhatsApp(canonical, code);
    } catch (error) {
      await this.prisma.mobileOtp
        .update({ where: { id: record.id }, data: { lastSentAt: previousSentAt } })
        .catch(() => undefined);
      throw this.otpDeliveryFailure(error);
    }

    return { mobileNo: this.maskMobile(canonical), expiresInMinutes: this.otpExpMinutes() };
  }

  /**
   * Reject a signup whose email or mobile number already belongs to an account.
   * Only the legacy email+password `register` path uses this; the OTP flow keys
   * on mobile alone.
   */
  private async assertContactAvailable(email: string, mobileNo: string): Promise<void> {
    const [emailTaken, mobileTaken] = await Promise.all([
      this.prisma.user.findFirst({ where: { email } }),
      this.prisma.user.findFirst({ where: { mobileNo } }),
    ]);
    if (emailTaken) throw new ConflictException('Email already registered');
    if (mobileTaken) throw new ConflictException('Mobile number already registered');
  }

  /** Map a User P2002 (unique violation) to the right "already registered" message. */
  private contactConflict(error: Prisma.PrismaClientKnownRequestError): ConflictException {
    const target = error.meta?.target;
    const fields = Array.isArray(target) ? target.map(String) : target ? [String(target)] : [];
    if (fields.some((f) => f.includes('mobileNo'))) {
      return new ConflictException('Mobile number already registered');
    }
    return new ConflictException('Email already registered');
  }

  /** Throw unless enough time has passed since the last code was sent. */
  private assertResendAllowed(lastSentAt: Date): void {
    const elapsedSeconds = (Date.now() - lastSentAt.getTime()) / 1000;
    if (elapsedSeconds < OTP_RESEND_COOLDOWN_SECONDS) {
      const wait = Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - elapsedSeconds);
      throw new BadRequestException(`Please wait ${wait}s before requesting another code.`);
    }
  }

  // ── Password reset ──────────────────────────────────────────────────────
  // Link-based flow: `forgotPassword` emails a one-time link containing a random
  // token; `resetPassword` verifies the token from that link and sets the new
  // password. Only the sha256 of the token is stored (never the token itself).

  /**
   * Email a password-reset link for the given address. Always returns the same
   * generic response whether or not an account exists, so it can't be used to
   * enumerate registered emails.
   */
  async forgotPassword(email: string) {
    const generic = {
      message: 'If an account exists for that email, a reset link is on its way.',
    };

    const user = await this.prisma.user.findFirst({ where: { email, deletedAt: null } });
    // Silently no-op for unknown or disabled accounts — same response either way.
    // OTP-only accounts have no email and no password, so there is nothing to
    // reset; they sign in with a WhatsApp code instead.
    if (!user || !user.isActive || !user.email) return generic;

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXP_MINUTES * 60_000);

    // One active token per user — a new request replaces any previous one.
    await this.prisma.passwordResetToken.upsert({
      where: { userId: user.id },
      create: { userId: user.id, tokenHash: this.digest(token), expiresAt },
      update: { tokenHash: this.digest(token), expiresAt },
    });

    const resetUrl = `${this.webAppUrl()}/reset-password?token=${token}`;
    const { subject, text, html } = buildPasswordResetEmail({
      firstName: user.firstName,
      resetUrl,
      expiresMinutes: PASSWORD_RESET_EXP_MINUTES,
    });
    this.logger.log(`Dispatching password-reset email to ${user.email}`);
    try {
      await this.mail.send({ to: user.email, subject, text, html });
      this.logger.log(`Password-reset email handed off to mailer for ${user.email}`);
    } catch (err) {
      // Don't surface a mail failure to the caller (it would reveal the email
      // exists), but DO log it so the failure is debuggable server-side.
      this.logger.error(
        `Failed to send password-reset email to ${user.email} — ${
          err instanceof Error ? err.message : String(err)
        }`,
        err instanceof Error ? err.stack : undefined,
      );
    }

    return generic;
  }

  /**
   * Verify the token from the emailed link and set a new password. Consumes the
   * token (single-use) and signs the user out of all sessions by clearing the
   * stored refresh token.
   */
  async resetPassword(token: string, newPassword: string) {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: this.digest(token) },
      include: { user: true },
    });

    if (!record || record.expiresAt.getTime() < Date.now()) {
      if (record) {
        await this.prisma.passwordResetToken.delete({ where: { id: record.id } });
      }
      throw new BadRequestException(
        'This reset link is invalid or has expired. Please request a new one.',
      );
    }

    const { user } = record;
    if (user.deletedAt || !user.isActive) {
      await this.prisma.passwordResetToken.delete({ where: { id: record.id } });
      throw new BadRequestException('This reset link is no longer valid.');
    }

    const passwordHash = await hash(newPassword, SALT_ROUNDS);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
      // A password change logs out every existing session for the account.
      this.prisma.refreshToken.deleteMany({ where: { userId: user.id } }),
      this.prisma.passwordResetToken.delete({ where: { id: record.id } }),
    ]);

    this.audit.log({
      module: AuditModule.AUTH,
      event: AuditEvent.UPDATION,
      moduleId: user.id,
      referenceNumber: user.email,
      subModule: 'password-reset',
      action: `Password reset for "${user.email}"`,
      auditedBy: user.email,
    });

    return { success: true };
  }

  /**
   * Legacy single-step registration. Retained for backward compatibility;
   * the web app now uses the OTP flow (start → verify). Creates an account
   * that has NOT verified its email.
   */
  async register(input: RegisterSchema, storefront: Storefront = 'web') {
    await this.assertContactAvailable(input.email, input.mobileNo);

    let user: User;
    try {
      user = await this.prisma.user.create({
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          name: `${input.firstName} ${input.lastName}`,
          email: input.email,
          mobileNo: input.mobileNo,
          city: input.city,
          state: input.state,
          role: this.roleForStorefront(storefront),
          passwordHash: await hash(input.password, SALT_ROUNDS),
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw this.contactConflict(error);
      }
      throw error;
    }

    this.auditUserCreated(user, 'legacy-register');
    return this.issueTokens(user);
  }

  async login(input: LoginSchema) {
    // The identifier is either an email or a mobile number — both are unique, so
    // an OR match returns at most one account.
    const user = await this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [{ email: input.identifier }, { mobileNo: input.identifier }],
      },
    });
    // Always run bcrypt (against a dummy hash when the account is unknown) so the
    // response time doesn't reveal whether the account exists.
    const passwordOk = await compare(input.password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
    if (!user || !passwordOk) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Account is disabled');
    }

    // Fold the last-login stamp into the same write that rotates the refresh token.
    return this.issueTokens(user, { lastLoginAt: new Date() });
  }

  /** Rotate tokens: validate the presented refresh token, then issue a fresh pair. */
  async refresh(refreshToken: string) {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.refreshSecret(),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // The refresh token must carry the session id (jti). Legacy tokens without
    // one (issued before the sessions model) can't be mapped — force re-login.
    if (!payload.jti) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const session = await this.prisma.refreshToken.findUnique({
      where: { id: payload.jti },
      include: { user: true },
    });
    if (!session || session.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const user = session.user;
    if (!user || user.deletedAt || !user.isActive) {
      // Session is dead if the account is gone/disabled — clean it up.
      await this.prisma.refreshToken.delete({ where: { id: session.id } }).catch(() => undefined);
      throw new UnauthorizedException('Invalid refresh token');
    }

    const matches = await compare(this.digest(refreshToken), session.tokenHash);
    if (!matches) {
      // Presented token doesn't match this session's current hash — it was
      // already rotated (replay / stolen token). Revoke the session defensively.
      await this.prisma.refreshToken.delete({ where: { id: session.id } }).catch(() => undefined);
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Rotate: retire this session and mint a fresh one. Only THIS session is
    // affected — the user's other sessions keep working.
    await this.prisma.refreshToken.delete({ where: { id: session.id } });
    return this.issueTokens(user);
  }

  /**
   * Log out. With a refresh token, revokes ONLY that session (other devices stay
   * signed in). Without one, revokes every session for the user ("log out
   * everywhere") — the safe fallback when the client can't supply its token.
   */
  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      try {
        const payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
          secret: this.refreshSecret(),
        });
        if (payload.jti && payload.sub === userId) {
          await this.prisma.refreshToken.deleteMany({ where: { id: payload.jti, userId } });
          return { success: true };
        }
      } catch {
        // Unverifiable token → fall through to revoke-all.
      }
    }
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
    return { success: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.toPublicUser(user);
  }

  private async issueTokens(user: User, extraData: Prisma.UserUpdateInput = {}) {
    // `email` on the payload is the account's IDENTITY for audit trails, not
    // necessarily an address: OTP-only accounts have no email, so the mobile
    // number stands in. Every `auditedBy: user.email` call site depends on this
    // being non-null.
    const basePayload: JwtPayload = {
      sub: user.id,
      email: user.email ?? user.mobileNo,
      role: user.role,
    };
    const refreshTtl = this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');

    // Create the session row first so its id can be embedded as the refresh
    // token's `jti` — refresh then looks up exactly this session to verify and
    // rotate, which is what lets a user hold many sessions at once (web + admin
    // + multiple tabs) without them invalidating each other. tokenHash is filled
    // in once the token exists.
    const session = await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: '',
        expiresAt: new Date(Date.now() + parseDurationMs(refreshTtl, SEVEN_DAYS_MS)),
      },
    });

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(basePayload),
      this.jwt.signAsync(
        { ...basePayload, jti: session.id },
        {
          secret: this.refreshSecret(),
          expiresIn: refreshTtl as `${number}${'m' | 'h' | 'd'}`,
        },
      ),
    ]);

    await this.prisma.refreshToken.update({
      where: { id: session.id },
      data: { tokenHash: await hash(this.digest(refreshToken), SALT_ROUNDS) },
    });

    // `extraData` currently only carries lastLoginAt on login — apply it to the
    // user row (the session is stored separately now).
    if (Object.keys(extraData).length > 0) {
      await this.prisma.user.update({ where: { id: user.id }, data: extraData });
    }

    return { accessToken, refreshToken, user: this.toPublicUser(user) };
  }

  /** Cryptographically-random 6-digit code, zero-padded (e.g. "004821"). */
  private generateOtp(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  private otpExpMinutes(): number {
    const raw = Number(this.config.get<string>('OTP_EXP_MINUTES'));
    return Number.isFinite(raw) && raw > 0 ? raw : OTP_EXP_MINUTES_DEFAULT;
  }

  private otpExpiry(): Date {
    return new Date(Date.now() + this.otpExpMinutes() * 60_000);
  }

  /**
   * Hand a registration OTP to the WhatsApp layer.
   *
   * Logs the dispatch (never the code itself) so the auth flow can be traced
   * end-to-end even when delivery fails downstream. Errors propagate — the
   * callers decide whether to roll back the pending row.
   */
  private async sendOtpWhatsApp(mobileNo: string, code: string): Promise<void> {
    this.logger.log(`Dispatching registration OTP via WhatsApp to ${this.maskMobile(mobileNo)}`);
    try {
      const result = await this.whatsapp.sendOtp(mobileNo, code);
      this.logger.log(
        `Registration OTP handed off to WhatsApp for ${this.maskMobile(mobileNo)} ` +
          `messageId=${result.messageId ?? 'n/a'}${result.simulated ? ' (SIMULATED)' : ''}`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to send registration OTP to ${this.maskMobile(mobileNo)} — ${
          err instanceof WhatsAppSendError ? err.describe() : String(err)
        }`,
        err instanceof Error ? err.stack : undefined,
      );
      throw err;
    }
  }

  /**
   * Translate a WhatsApp delivery failure into an HTTP error for the signup form.
   *
   * Meta's own wording is never forwarded: it is written for developers, and some
   * of it discloses our configuration. Only the recipient case gets a specific
   * message, because that one the user can actually act on.
   */
  private otpDeliveryFailure(error: unknown): Error {
    if (error instanceof WhatsAppSendError && error.kind === 'recipient') {
      return new BadRequestException(
        'We could not reach that number on WhatsApp. Check the number and make sure it has an active WhatsApp account.',
      );
    }
    return new ServiceUnavailableException(
      'We could not send your verification code right now. Please try again in a moment.',
    );
  }

  /** Mask all but the last 4 digits of a mobile number for safe logging. */
  private maskMobile(mobileNo: string): string {
    const digits = mobileNo.replace(/\D/g, '');
    if (digits.length <= 4) return '****';
    return `${'*'.repeat(digits.length - 4)}${digits.slice(-4)}`;
  }

  /**
   * sha256 hex digest. Used both to bind refresh tokens (bcrypt silently
   * truncates at 72 bytes, so we hash first) and to store OTP codes without
   * keeping them in the clear.
   */
  private digest(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private refreshSecret(): string {
    const secret = this.config.get<string>('JWT_REFRESH_SECRET');
    if (!secret) {
      throw new Error('JWT_REFRESH_SECRET is not set');
    }
    return secret;
  }

  /** Base URL of the storefront web app, used to build the reset link. */
  private webAppUrl(): string {
    return this.config.get<string>('WEB_APP_URL', 'http://localhost:3000');
  }

  private toPublicUser(user: User) {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      name: user.name,
      email: user.email,
      mobileNo: user.mobileNo,
      city: user.city,
      state: user.state,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
