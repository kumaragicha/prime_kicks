import type { UserRole } from '@prisma/client';

/** Shape of the signed JWT body. */
export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  /** Refresh tokens only: the RefreshToken session id this token belongs to.
   *  Absent on access tokens (and on legacy pre-sessions refresh tokens). */
  jti?: string;
}

/** What the strategy attaches to `request.user`. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
}
