export type UserRole = 'CUSTOMER' | 'RESELLER' | 'ADMIN';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  mobileNo: string;
  city: string;
  state: string;
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
>;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse extends AuthTokens {
  user: PublicUser;
}
