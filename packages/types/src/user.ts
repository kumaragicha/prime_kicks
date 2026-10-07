export type UserRole = 'CUSTOMER' | 'RESELLER' | 'ADMIN';

export interface User {
  id: string;
  firstName: string;
  /** null when the account was created from a single-word name. */
  lastName: string | null;
  name: string;
  /**
   * null for accounts created through the mobile OTP flow — the storefront only
   * collects a name and a mobile number. `mobileNo` is the account identity.
   */
  email: string | null;
  mobileNo: string;
  /** null for OTP accounts — delivery details come from the checkout address. */
  city: string | null;
  state: string | null;
  role: UserRole;
  isActive: boolean;
  isEmailVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

/** Row shape returned by the admin `GET /users` endpoint (no secrets, no deletedAt). */
export type AdminUserRow = Omit<User, 'deletedAt'>;

/** User shape safe to return to clients (no auth secrets). */
export type PublicUser = Pick<
  User,
  | 'id'
  | 'firstName'
  | 'lastName'
  | 'name'
  | 'email'
  | 'mobileNo'
  | 'city'
  | 'state'
  | 'role'
  | 'isEmailVerified'
  | 'createdAt'
>;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse extends AuthTokens {
  user: PublicUser;
}
