import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type {
  LoginSchema,
  RegisterSchema,
  RegisterStartSchema,
  VerifyEmailOtpSchema,
} from '@prime-kicks/validation';
import {
  AuditEvent,
  AuditModule,
  Prisma,
  type PendingRegistration,
  type User,
} from '@prisma/client';
import { compare, hash } from 'bcryptjs';
import { createHash, randomBytes, randomInt } from 'node:crypto';
import { AuditLogService } from '../audit-log/audit-log.service';
import { MailService } from '../mail/mail.service';
import { buildOtpEmail } from '../mail/templates/otp.template';
import { buildPasswordResetEmail } from '../mail/templates/password-reset.template';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload } from './auth.types';

const SALT_ROUNDS = 10;

/**
 * A pre-computed bcrypt hash compared against when a login email is unknown, so
 * a failed login takes the same time whether or not the account exists — closing
 * the user-enumeration timing oracle. (No real password ever produces it.)
 */
const DUMMY_PASSWORD_HASH = '$2a$10$RCurgRADPFnitP7XH5QEpeMLWdnPeQo8i6LnpI2m.TOJCKyaazcwm';

/** How long an emailed OTP stays valid, in minutes. */
const OTP_EXP_MINUTES_DEFAULT = 10;
/** Wrong-code submissions allowed before the pending signup must request a new code. */
const OTP_MAX_ATTEMPTS = 5;
/** Minimum seconds between OTP (re)send requests for the same email. */
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

  // ── Email-OTP registration ──────────────────────────────────────────────
  // Registration is a two step, verify-before-create flow:
  //   1) `startRegistration` stashes the (password-hashed) signup in
  //      PendingRegistration and emails a 6-digit code — no User row yet.
  //   2) `verifyRegistration` checks the code, then creates the verified User
  //      and issues tokens. `resendRegistrationOtp` re-sends a fresh code.

  /**
   * Reject a signup whose email or mobile number already belongs to an account.
   * Both are unique identities, so both are checked up front for a friendly error
   * (the DB unique constraints are the ultimate backstop — see resetIfTaken use).
   */
  private async assertContactAvailable(email: string, mobileNo: string): Promise<void> {
    const [emailTaken, mobileTaken] = await Promise.all([
      this.prisma.user.findUnique({ where: { email } }),
      this.prisma.user.findFirst({ where: { mobileNo } }),
    ]);
    if (emailTaken) throw new ConflictException('Email already registered');
    if (mobileTaken) throw new ConflictException('Mobile number already registered');
  }

  /**
   * Create the verified User from a pending registration. A unique violation
   * (email/mobile claimed in the window between step 1 and step 2) is mapped to a
   * friendly conflict, and the now-unusable pending row is discarded.
   */
  private async createVerifiedUser(pending: PendingRegistration): Promise<User> {
    try {
      return await this.prisma.user.create({
        data: {
          firstName: pending.firstName,
          lastName: pending.lastName,
          name: `${pending.firstName} ${pending.lastName}`,
          email: pending.email,
          mobileNo: pending.mobileNo,
          city: pending.city,
          state: pending.state,
          role: pending.role,
          passwordHash: pending.passwordHash,
          isEmailVerified: true,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        await this.prisma.pendingRegistration.delete({ where: { id: pending.id } }).catch(() => {});
        throw this.contactConflict(error);
      }
      throw error;
    }
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

  /** Step 1: validate, store the pending signup, and email an OTP. */
  async startRegistration(input: RegisterStartSchema) {
    await this.assertContactAvailable(input.email, input.mobileNo);

    const code = this.generateOtp();
    const passwordHash = await hash(input.password, SALT_ROUNDS);

    await this.prisma.pendingRegistration.upsert({
      where: { email: input.email },
      create: {
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        mobileNo: input.mobileNo,
        city: input.city,
        state: input.state,
        role: input.role,
        passwordHash,
        codeHash: this.digest(code),
        expiresAt: this.otpExpiry(),
      },
      update: {
        firstName: input.firstName,
        lastName: input.lastName,
        mobileNo: input.mobileNo,
        city: input.city,
        state: input.state,
        role: input.role,
        passwordHash,
        codeHash: this.digest(code),
        expiresAt: this.otpExpiry(),
        attempts: 0,
        lastSentAt: new Date(),
      },
    });

    await this.sendOtpEmail(input.email, input.firstName, code);

    return { email: input.email, expiresInMinutes: this.otpExpMinutes() };
  }

  /** Step 2: confirm the OTP, then create the verified account and issue tokens. */
  async verifyRegistration(input: VerifyEmailOtpSchema) {
    const pending = await this.prisma.pendingRegistration.findUnique({
      where: { email: input.email },
    });
    if (!pending) {
      throw new BadRequestException('No pending registration for this email. Please start again.');
    }

    if (pending.expiresAt.getTime() < Date.now()) {
      await this.prisma.pendingRegistration.delete({ where: { id: pending.id } });
      throw new BadRequestException('This code has expired. Please request a new one.');
    }

    if (pending.attempts >= OTP_MAX_ATTEMPTS) {
      await this.prisma.pendingRegistration.delete({ where: { id: pending.id } });
      throw new BadRequestException('Too many incorrect attempts. Please start again.');
    }

    if (this.digest(input.code) !== pending.codeHash) {
      await this.prisma.pendingRegistration.update({
        where: { id: pending.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException('Incorrect code. Please try again.');
    }

    // Guard against the email/mobile being taken between step 1 and step 2.
    // The DB unique constraints are the final backstop (handled below).
    const user = await this.createVerifiedUser(pending);

    await this.prisma.pendingRegistration.delete({ where: { id: pending.id } });

    this.auditUserCreated(user, 'otp-verified');
    return this.issueTokens(user);
  }

  /** Re-send a fresh OTP for a pending signup, subject to a cooldown. */
  async resendRegistrationOtp(email: string) {
    const pending = await this.prisma.pendingRegistration.findUnique({ where: { email } });
    if (!pending) {
      throw new BadRequestException('No pending registration for this email. Please start again.');
    }

    const elapsedSeconds = (Date.now() - pending.lastSentAt.getTime()) / 1000;
    if (elapsedSeconds < OTP_RESEND_COOLDOWN_SECONDS) {
      const wait = Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - elapsedSeconds);
      throw new BadRequestException(`Please wait ${wait}s before requesting another code.`);
    }

    const code = this.generateOtp();
    await this.prisma.pendingRegistration.update({
      where: { id: pending.id },
      data: {
        codeHash: this.digest(code),
        expiresAt: this.otpExpiry(),
        attempts: 0,
        lastSentAt: new Date(),
      },
    });

    await this.sendOtpEmail(pending.email, pending.firstName, code);

    return { email: pending.email, expiresInMinutes: this.otpExpMinutes() };
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
    if (!user || !user.isActive) return generic;

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
  async register(input: RegisterSchema) {
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
          role: input.role,
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
    const basePayload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
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

  private async sendOtpEmail(email: string, firstName: string, code: string): Promise<void> {
    const { subject, text, html } = buildOtpEmail({
      firstName,
      code,
      expiresMinutes: this.otpExpMinutes(),
    });
    // Log the OTP dispatch (never the code itself) so we can confirm the auth
    // flow reached the mail layer even if delivery later fails downstream.
    this.logger.log(`Dispatching registration OTP email to ${email}`);
    try {
      await this.mail.send({ to: email, subject, text, html });
      this.logger.log(`Registration OTP email handed off to mailer for ${email}`);
    } catch (err) {
      this.logger.error(
        `Failed to send registration OTP email to ${email} — ${
          err instanceof Error ? err.message : String(err)
        }`,
        err instanceof Error ? err.stack : undefined,
      );
      throw err;
    }
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
