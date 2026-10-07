# WhatsApp OTP — setup and operations

Storefront sign-up AND sign-in run on a WhatsApp OTP sent through the Meta Cloud
API. There is no password and no email on the storefront; SMTP now only carries
password-reset links for pre-existing (admin) accounts.

## Flow

```
POST /auth/otp/start   { mobileNo }              → send code, return isNewUser
POST /auth/otp/verify  { mobileNo, code, name? } → sign in, creating the account if new
POST /auth/otp/resend  { mobileNo }              → fresh code, 60s cooldown
```

Codes live in `MobileOtp`, one row per number, stored as sha256. They expire
after `OTP_EXP_MINUTES` and allow 5 wrong attempts, after which the code is
destroyed and a new one must be requested. A code is consumed on success and on
every terminal failure, so it can never be replayed.

See `reseller-app.md` for how the account's role is decided.

## Environment

| Var | Notes |
| --- | --- |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta → app → WhatsApp → API Setup, under the *From* number |
| `WHATSAPP_ACCESS_TOKEN` | **System User token.** The API Setup token expires in 24h |
| `WHATSAPP_API_VERSION` | Default `v22.0`. Pinned — bump deliberately |
| `WHATSAPP_OTP_TEMPLATE` | Default `prime_kicks_otp`. Must be APPROVED on the WABA |
| `WHATSAPP_OTP_TEMPLATE_LANG` | Must match the template exactly (`en` ≠ `en_US`) |
| `WHATSAPP_DEFAULT_COUNTRY_CODE` | Default `91`; prepended to bare 10-digit numbers |
| `WHATSAPP_TIMEOUT_MS` | Default `10000` |
| `OTP_LOG_CODES` | `true` prints each code to the API console. **Refused when `NODE_ENV=production`** |

With the first two blank, codes are **logged to the console** instead of sent —
local dev works with zero setup. That fallback throws when `NODE_ENV=production`.

## Current Meta assets

| | |
| --- | --- |
| Business portfolio | `shopping_street02` (`1187052549445778`) |
| Developer app | `primekicks` (`1049822567907360`) |
| WABA | Test WABA (`4466351220249804`) |
| Phone number | `+1 555-198-7748` (id `1268449313024551`) |

⚠️ **The Test WABA cannot create message templates** (error 10 / subcode
2388185) and ships only with Meta's demo templates — `hello_world` and four
"Jasper's Market" samples, none of them Authentication category. **OTP cannot be
sent from it.** A real WABA with a registered number is required.

## Going live

1. Obtain a phone number with **no existing WhatsApp account** — a fresh prepaid
   SIM, or an office landline (verifies by voice call). Converting a number is
   irreversible: its WhatsApp account and history are deleted, and it can no
   longer be used in the WhatsApp app.
2. Meta → app → WhatsApp → Step 2 Production setup → **Register your WhatsApp
   phone number**.
3. Start **business verification** early — it is document review by Meta and the
   slowest step. Unverified accounts can send, but under tight limits.
4. Add a payment method (real-number sends are billed; the test number is free).
5. Create the Authentication template:

   ```bash
   curl -X POST "https://graph.facebook.com/v22.0/<WABA_ID>/message_templates" \
     -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
     -d @docs/whatsapp-otp-template.json
   ```

6. Create a System User with `whatsapp_business_messaging` +
   `whatsapp_business_management`, assign the WABA, and generate a permanent token.
7. Publish the app (Live mode) — development mode can only message allowlisted
   test recipients.
8. Set `WHATSAPP_PHONE_NUMBER_ID` and `WHATSAPP_ACCESS_TOKEN`. No code changes.

## Debugging

Every send logs a numbered trail at `WhatsAppService`:

```
[OTP 1/5] Preparing …      template name + masked recipient
[OTP 2/5] Payload …        full payload, code redacted
[OTP 3/5] POST …           URL + attempt number
[OTP 4/5] Response …       HTTP status + latency + raw body (debug level)
[OTP 5/5] ACCEPTED …       message id + wa_id
```

Phone numbers are masked to their last 4 digits throughout.

### Getting a code while there is no WABA

Set `OTP_LOG_CODES="true"` in `apps/api/.env` and **restart the API** (`.env` is
read at boot, not on watch-reload). Each request then prints:

```
WARN [WhatsAppService] [OTP CODE] to=91******0001 code=980369  ← OTP_LOG_CODES is enabled
```

It is logged *before* the send, deliberately: with real test-WABA credentials the
send fails (no authentication template), and a code logged only on success would
be useless for testing exactly that case.

A logged code is a working login for that account. The flag is therefore ignored
when `NODE_ENV=production`, which logs instead:

```
ERROR REFUSING to log OTP codes. A logged code is a working login for that account.
```

Both behaviours are covered by tests in `whatsapp.service.spec.ts`.

### Common errors

| Code | Meaning | Fix |
| --- | --- | --- |
| `190` | Token invalid/expired | Temporary tokens last 24h — use a System User token |
| `131030` | Recipient not allowlisted | Test numbers only reach the 5 numbers in API Setup → *To* |
| `131026` | Undeliverable | Number has no WhatsApp account, or is unreachable |
| `132001` | Template missing/unapproved | Check `WHATSAPP_OTP_TEMPLATE` and the language code |
| `132000` | Parameter count mismatch | Auth templates need the code in **both** body and button |
| `130429` / `80007` | Rate limited | Retried automatically, then surfaced |

Failures are classified as `configuration` / `recipient` / `rate_limited` /
`transient` / `unknown`. Only transient and rate-limited failures are retried
(twice, 500ms backoff); a 4xx rejection is never retried.

A 200 response with **no `wa_id`** means WhatsApp could not resolve the number —
the message was accepted but will not arrive. This is logged as a warning.

## Known gaps

- **No delivery confirmation.** Meta returns 200 when it *queues* a message.
  Actual delivery is only knowable from webhooks, which are not configured. Until
  then the API cannot distinguish "sent" from "arrived", so there is no automatic
  fallback channel when WhatsApp delivery fails.
- **`User.isEmailVerified`** now records "contact verified via WhatsApp OTP".
  It should be renamed `isContactVerified`; deferred because it is exposed
  through `@prime-kicks/types` and the admin UI.
