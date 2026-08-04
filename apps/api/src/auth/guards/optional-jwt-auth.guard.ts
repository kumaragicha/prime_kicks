import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Like JwtAuthGuard but does NOT throw when no token is present.
 * If a valid token is supplied, `request.user` is populated; otherwise it stays undefined.
 * Used for endpoints that behave differently based on the caller's role
 * (e.g. product pricing) but are still accessible to anonymous visitors.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest<TUser = any>(err: any, user: any): TUser {
    // Swallow auth errors — anonymous access is allowed.
    if (err || !user) {
      return undefined as TUser;
    }
    return user as TUser;
  }
}
