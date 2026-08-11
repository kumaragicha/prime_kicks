import { z } from 'zod';

/** A non-login bulk/credit customer created by an admin. */
export const createCreditCustomerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  mobileNo: z.string().trim().regex(/^\d{10}$/, 'Mobile number must be 10 digits'),
  email: z.string().trim().email('Enter a valid email').optional().or(z.literal('')),
  city: z.string().trim().max(80).optional().or(z.literal('')),
  state: z.string().trim().max(80).optional().or(z.literal('')),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
});

export const updateCreditCustomerSchema = createCreditCustomerSchema.partial();

export const creditCustomerQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
});

export type CreateCreditCustomerSchema = z.infer<typeof createCreditCustomerSchema>;
export type UpdateCreditCustomerSchema = z.infer<typeof updateCreditCustomerSchema>;
export type CreditCustomerQuerySchema = z.infer<typeof creditCustomerQuerySchema>;
