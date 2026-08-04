import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import {
  loginSchema,
  refreshSchema,
  registerSchema,
  registerStartSchema,
  resendEmailOtpSchema,
  verifyEmailOtpSchema,
  type LoginSchema,
  type RefreshSchema,
  type RegisterSchema,
  type RegisterStartSchema,
  type ResendEmailOtpSchema,
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
