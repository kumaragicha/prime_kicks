import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import {
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  registerStartSchema,
  resendEmailOtpSchema,
  resetPasswordSchema,
  verifyEmailOtpSchema,
  type ForgotPasswordSchema,
  type LoginSchema,
  type RefreshSchema,
  type RegisterSchema,
  type RegisterStartSchema,
  type ResendEmailOtpSchema,
  type ResetPasswordSchema,
  type VerifyEmailOtpSchema,
} from '@prime-kicks/validation';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthenticatedUser } from './auth.types';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  register(@Body(new ZodValidationPipe(registerSchema)) body: RegisterSchema) {
    return this.auth.register(body);
  }

  /** Step 1 of OTP registration: stash the signup and email a verification code. */
  @Public()
  @HttpCode(200)
  @Post('register/start')
  registerStart(
    @Body(new ZodValidationPipe(registerStartSchema)) body: RegisterStartSchema,
  ) {
    return this.auth.startRegistration(body);
  }

  /** Step 2: confirm the emailed code, create the verified account, issue tokens. */
  @Public()
  @HttpCode(200)
  @Post('register/verify')
  registerVerify(
    @Body(new ZodValidationPipe(verifyEmailOtpSchema)) body: VerifyEmailOtpSchema,
  ) {
    return this.auth.verifyRegistration(body);
  }

  /** Re-send a fresh verification code for a pending signup. */
  @Public()
  @HttpCode(200)
  @Post('register/resend')
  registerResend(
    @Body(new ZodValidationPipe(resendEmailOtpSchema)) body: ResendEmailOtpSchema,
  ) {
    return this.auth.resendRegistrationOtp(body.email);
  }

  @Public()
  @HttpCode(200)
  @Post('login')
  login(@Body(new ZodValidationPipe(loginSchema)) body: LoginSchema) {
    return this.auth.login(body);
  }

  @Public()
  @HttpCode(200)
  @Post('refresh')
  refresh(@Body(new ZodValidationPipe(refreshSchema)) body: RefreshSchema) {
    return this.auth.refresh(body.refreshToken);
  }

  /** Request a password-reset link by email. Always 200 (no account enumeration). */
  @Public()
  @HttpCode(200)
  @Post('forgot-password')
  forgotPassword(@Body(new ZodValidationPipe(forgotPasswordSchema)) body: ForgotPasswordSchema) {
    return this.auth.forgotPassword(body.email);
  }

  /** Complete a password reset using the token from the emailed link. */
  @Public()
  @HttpCode(200)
  @Post('reset-password')
  resetPassword(@Body(new ZodValidationPipe(resetPasswordSchema)) body: ResetPasswordSchema) {
    return this.auth.resetPassword(body.token, body.password);
  }

  @HttpCode(200)
  @Post('logout')
  logout(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.logout(user.id);
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.me(user.id);
  }
}
