import { otpStartSchema, otpVerifySchema } from './user.schema';

const mobile = (value: unknown) => otpStartSchema.safeParse({ mobileNo: value }).success;
const verify = (value: Record<string, unknown>) => otpVerifySchema.safeParse(value).success;

describe('otpStartSchema.mobileNo', () => {
  it.each([
    '9876543210', // national 10-digit
    '09876543210', // with trunk prefix
    '+919876543210', // E.164 India
    '+14155552671', // E.164 US
    '+442071838750', // E.164 UK
    ' 9876543210 ', // surrounding whitespace
  ])('accepts %s', (value) => expect(mobile(value)).toBe(true));

  it.each([
    ['9 digits — a code would be sent nowhere', '987654321'],
    ['8 digits', '98765432'],
    ['11 digits with no country code', '98765432101'],
    ['starts with 0 after trunk strip', '0012345678'],
    ['letters', 'abcdefghij'],
    ['SQL-ish', '1 OR 1=1--'],
    ['20 digits', '12345678901234567890'],
    ['empty', ''],
    ['just a plus', '+'],
    ['plus with 9 digits', '+123456789'],
    ['number, not a string', 9876543210],
    ['null', null],
  ])('rejects %s', (_label, value) => expect(mobile(value)).toBe(false));
});

describe('otpVerifySchema', () => {
  const base = { mobileNo: '9876543210', code: '123456' };

  it('accepts a valid sign-in payload with no name', () => {
    expect(verify(base)).toBe(true);
  });

  it('accepts a valid sign-up payload with a name', () => {
    expect(verify({ ...base, name: 'Rita Sharma' })).toBe(true);
  });

  it.each([
    ['5-digit code', '12345'],
    ['7-digit code', '1234567'],
    ['letters', 'abcdef'],
    ['empty', ''],
  ])('rejects a %s', (_label, code) => expect(verify({ ...base, code })).toBe(false));

  it.each([
    ['digits', 'Rita9'],
    ['angle brackets', '<script>'],
    ['an empty string', ''],
    ['only whitespace', '   '],
    ['81 characters', 'A'.repeat(81)],
  ])('rejects a name with %s', (_label, name) =>
    expect(verify({ ...base, name })).toBe(false),
  );

  it('accepts a name at the 80-character limit', () => {
    expect(verify({ ...base, name: 'A'.repeat(80) })).toBe(true);
  });

  it('accepts non-Latin scripts', () => {
    expect(verify({ ...base, name: 'रीता शर्मा' })).toBe(true);
  });

  it('strips an injected role rather than failing — role comes from the storefront', () => {
    const parsed = otpVerifySchema.safeParse({ ...base, name: 'Eve', role: 'ADMIN' });
    expect(parsed.success).toBe(true);
    expect(parsed.success && 'role' in parsed.data).toBe(false);
  });
});
