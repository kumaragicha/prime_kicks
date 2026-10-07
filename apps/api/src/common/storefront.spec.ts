import { __resetStorefrontKeyCache, readStorefront, resolvePricingAudience } from './storefront';

const KEY = 'test-storefront-key-abcdefghijklmnop';

/** Run a block with a specific key + NODE_ENV, restoring both afterwards. */
function withEnv(env: { key?: string; nodeEnv?: string }, fn: () => void) {
  const prevKey = process.env.RESELLER_STOREFRONT_KEY;
  const prevNode = process.env.NODE_ENV;
  if (env.key === undefined) delete process.env.RESELLER_STOREFRONT_KEY;
  else process.env.RESELLER_STOREFRONT_KEY = env.key;
  if (env.nodeEnv) process.env.NODE_ENV = env.nodeEnv;
  __resetStorefrontKeyCache();
  try {
    fn();
  } finally {
    if (prevKey === undefined) delete process.env.RESELLER_STOREFRONT_KEY;
    else process.env.RESELLER_STOREFRONT_KEY = prevKey;
    process.env.NODE_ENV = prevNode;
    __resetStorefrontKeyCache();
  }
}

const read = (value: unknown) => readStorefront({ 'x-storefront': value });

describe('readStorefront — with a key configured', () => {
  it('accepts the exact key', () => {
    withEnv({ key: KEY }, () => expect(read(KEY)).toBe('reseller'));
  });

  it('takes the first value when the header is repeated', () => {
    withEnv({ key: KEY }, () =>
      expect(readStorefront({ 'x-storefront': [KEY, 'web'] })).toBe('reseller'),
    );
  });

  it.each([
    ['the literal word reseller', 'reseller'],
    ['a wrong key of the same length', 'X'.repeat(KEY.length)],
    ['the key with one character changed', KEY.slice(0, -1) + 'X'],
    ['the key with trailing whitespace', KEY + ' '],
    ['a prefix of the key', KEY.slice(0, 10)],
    ['the key plus extra', KEY + 'extra'],
    ['different case', KEY.toUpperCase()],
    ['empty', ''],
    ['missing', undefined],
    ['null', null],
    ['a number', 12345],
  ])('falls back to web for %s', (_label, value) => {
    withEnv({ key: KEY }, () => expect(read(value)).toBe('web'));
  });
});

describe('readStorefront — with no key configured', () => {
  it('FAILS CLOSED in production: nothing selects reseller pricing', () => {
    withEnv({ key: undefined, nodeEnv: 'production' }, () => {
      expect(read('reseller')).toBe('web');
      expect(read(KEY)).toBe('web');
    });
  });

  it('accepts the literal "reseller" outside production, for local dev', () => {
    withEnv({ key: undefined, nodeEnv: 'development' }, () => {
      expect(read('reseller')).toBe('reseller');
      expect(read('RESELLER')).toBe('reseller');
      expect(read('something-else')).toBe('web');
    });
  });

  it('treats a blank key as unset rather than as a matchable empty value', () => {
    withEnv({ key: '   ', nodeEnv: 'production' }, () => {
      expect(read('')).toBe('web');
      expect(read('   ')).toBe('web');
    });
  });
});

describe('resolvePricingAudience', () => {
  it('gives an anonymous reseller-storefront visitor reseller pricing', () => {
    expect(resolvePricingAudience(undefined, 'reseller')).toBe('RESELLER');
  });

  it('gives an anonymous public visitor customer pricing', () => {
    expect(resolvePricingAudience(undefined, 'web')).toBe('CUSTOMER');
  });

  it('gives a RESELLER account reseller pricing on the public storefront too', () => {
    expect(resolvePricingAudience({ role: 'RESELLER' }, 'web')).toBe('RESELLER');
  });

  it('gives a CUSTOMER account customer pricing on the public storefront', () => {
    expect(resolvePricingAudience({ role: 'CUSTOMER' }, 'web')).toBe('CUSTOMER');
  });

  it('shows a logged-in CUSTOMER reseller pricing on the reseller storefront', () => {
    // Display only. Their ORDER is still priced from their CUSTOMER role in
    // OrdersService, which no header can influence.
    expect(resolvePricingAudience({ role: 'CUSTOMER' }, 'reseller')).toBe('RESELLER');
  });

  it('never grants reseller pricing to an admin on the public storefront', () => {
    expect(resolvePricingAudience({ role: 'ADMIN' }, 'web')).toBe('CUSTOMER');
  });
});
