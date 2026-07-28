import { z } from 'zod';

export const userRoleSchema = z.enum(['CUSTOMER', 'RESELLER', 'ADMIN']);

/** E.164-ish: optional leading +, 7–15 digits. */
const mobileNoSchema = z
  .string()
  .regex(/^\+?[1-9]\d{6,14}$/, 'Enter a valid mobile number');

export const registerSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email(),
  mobileNo: mobileNoSchema,
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: userRoleSchema.default('CUSTOMER'),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'refreshToken is required'),
});

export const updateUserSchema = registerSchema
  .omit({ password: true, role: true })
  .partial();

export const userStatusSchema = z.enum(['active', 'disabled']);

export const userQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  role: userRoleSchema.optional(),
  status: userStatusSchema.optional(),
});

export type RegisterSchema = z.infer<typeof registerSchema>;
export type LoginSchema = z.infer<typeof loginSchema>;
export type RefreshSchema = z.infer<typeof refreshSchema>;
export type UpdateUserSchema = z.infer<typeof updateUserSchema>;
export type UserQuerySchema = z.infer<typeof userQuerySchema>;
