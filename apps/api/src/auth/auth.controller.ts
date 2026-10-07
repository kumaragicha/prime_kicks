import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import {
  forgotPasswordSchema,
  loginSchema,
  otpResendSchema,
  otpStartSchema,
  otpVerifySchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
  type ForgotPasswordSchema,
  type LoginSchema,
  type OtpResendSchema,
  type OtpStartSchema,
  type OtpVerifySchema,
  type RefreshSchema,
  type RegisterSchema,
  type ResetPasswordSchema,
} from '@prime-kicks/validation';
import { CurrentStorefront, type Storefront } from '../common/storefront';
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
  register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterSchema,
    @CurrentStorefront() storefront: Storefront,
  ) {
    return this.auth.register(body, storefront);
  }

  /**
   * Step 1 of the storefront auth flow: send a WhatsApp code to a mobile number.
   *
   * Serves BOTH sign-up and login. The response's `isNewUser` tells the client
   * whether to collect a name before calling verify.
   */
  @Public()
  @HttpCode(200)
  @Post('otp/start')
  otpStart(@Body(new ZodValidationPipe(otpStartSchema)) body: OtpStartSchema) {
    return this.auth.startOtp(body.mobileNo);
  }

  /**
   * Step 2: confirm the code and issue tokens — creating the account first when
   * the number is new. The account's role comes from the calling storefront,
   * never from the body (see `AuthService.roleForStorefront`).
   */
  @Public()
  @HttpCode(200)
  @Post('otp/verify')
  otpVerify(
    @Body(new ZodValidationPipe(otpVerifySchema)) body: OtpVerifySchema,
    @CurrentStorefront() storefront: Storefront,
  ) {
    return this.auth.verifyOtp(body, storefront);
  }

  /** Re-send a fresh code for a mobile number, subject to the cooldown. */
  @Public()
  @HttpCode(200)
  @Post('otp/resend')
  otpResend(@Body(new ZodValidationPipe(otpResendSchema)) body: OtpResendSchema) {
    return this.auth.resendOtp(body.mobileNo);
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

  /** Log out. Send the current refresh token to revoke only this session;
   *  omit it to log out of every session for the account. */
  @HttpCode(200)
  @Post('logout')
  logout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { refreshToken?: string } = {},
  ) {
    return this.auth.logout(user.id, body?.refreshToken);
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.me(user.id);
  }
}
