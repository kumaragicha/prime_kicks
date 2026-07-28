import type { UserRole } from '@prisma/client';

/** Shape of the signed JWT body. */
export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
}

/** What the strategy attaches to `request.user`. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
}
