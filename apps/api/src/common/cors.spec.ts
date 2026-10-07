import { corsOptions } from './cors';

describe('corsOptions', () => {
  it('allows all three storefronts by default', () => {
    expect(corsOptions({})).toMatchObject({
      origin: [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3002',
      ],
      credentials: true,
    });
  });

  it('takes CORS_ORIGINS when set', () => {
    expect(corsOptions({ CORS_ORIGINS: 'https://a.com,https://b.com' }).origin).toEqual([
      'https://a.com',
      'https://b.com',
    ]);
  });

  it('trims whitespace and drops empty entries', () => {
    expect(corsOptions({ CORS_ORIGINS: ' https://a.com , , https://b.com ' }).origin).toEqual([
      'https://a.com',
      'https://b.com',
    ]);
  });

  // ── Regression guard ────────────────────────────────────────────────────
  // Setting allowedHeaders once broke checkout: the list omitted
  // `Idempotency-Key`, so POST /orders was blocked by the browser while the
  // preflight still passed. Unset means the middleware reflects whatever the
  // client asks for, which is what we want.
  it('does NOT enumerate allowedHeaders, so every client header is reflected', () => {
    expect(corsOptions({})).not.toHaveProperty('allowedHeaders');
  });
});
