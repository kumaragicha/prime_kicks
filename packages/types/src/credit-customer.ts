/** A non-login bulk/credit customer (admin-managed; not a login User). */
export interface CreditCustomer {
  id: string;
  name: string;
  mobileNo: string;
  email: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
