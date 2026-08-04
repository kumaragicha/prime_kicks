import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomInt } from 'node:crypto';
import { compare, hash } from 'bcryptjs';
import type { User } from '@prisma/client';
import type {
  LoginSchema,
  RegisterSchema,
  RegisterStartSchema,
  VerifyEmailOtpSchema,
} from '@prime-kicks/validation';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { buildOtpEmail } from '../mail/templates/otp.template';
import type { JwtPayload } from './auth.types';

const SALT_ROUNDS = 10;

/** How long an emailed OTP stays valid, in minutes. */
const OTP_EXP_MINUTES_DEFAULT = 10;
/** Wrong-code submissions allowed before the pending signup must request a new code. */
const OTP_MAX_ATTEMPTS = 5;
/** Minimum seconds between OTP (re)send requests for the same email. */
const OTP_RESEND_COOLDOWN_SECONDS = 60;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  // ── Email-OTP registration ──────────────────────────────────────────────
  // Registration is a two step, verify-before-create flow:
  //   1) `startRegistration` stashes the (password-hashed) signup in
  //      PendingRegistration and emails a 6-digit code — no User row yet.
  //   2) `verifyRegistration` checks the code, then creates the verified User
  //      and issues tokens. `resendRegistrationOtp` re-sends a fresh code.

  /** Step 1: validate, store the pending signup, and email an OTP. */
  async startRegistration(input: RegisterStartSchema) {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

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

    // Guard against a duplicate account being created between step 1 and step 2.
    const existing = await this.prisma.user.findUnique({ where: { email: pending.email } });
    if (existing) {
      await this.prisma.pendingRegistration.delete({ where: { id: pending.id } });
      throw new ConflictException('Email already registered');
    }

    const user = await this.prisma.user.create({
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

    await this.prisma.pendingRegistration.delete({ where: { id: pending.id } });

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

  /**
   * Legacy single-step registration. Retained for backward compatibility;
   * the web app now uses the OTP flow (start → verify). Creates an account
   * that has NOT verified its email.
   */
  async register(input: RegisterSchema) {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const user = await this.prisma.user.create({
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

    return this.issueTokens(user);
  }

  async login(input: LoginSchema) {
    const user = await this.prisma.user.findFirst({
      where: { email: input.email, deletedAt: null },
    });
    if (!user || !(await compare(input.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Account is disabled');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.issueTokens(user);
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

    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, deletedAt: null },
    });
    if (!user || !user.refreshTokenHash || !user.isActive) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const matches = await compare(this.digest(refreshToken), user.refreshTokenHash);
    if (!matches) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.issueTokens(user);
  }

  /** Invalidate the stored refresh token. */
  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
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

  private async issueTokens(user: User) {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload),
      this.jwt.signAsync(payload, {
        secret: this.refreshSecret(),
        expiresIn: this.config.get<string>(
          'JWT_REFRESH_EXPIRES_IN',
          '7d',
        ) as `${number}${'m' | 'h' | 'd'}`,
      }),
    ]);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: await hash(this.digest(refreshToken), SALT_ROUNDS) },
    });

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
    await this.mail.send({ to: email, subject, text, html });
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
    };
  }
}
