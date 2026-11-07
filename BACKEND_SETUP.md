# Backend setup

The app uses Supabase Auth and Postgres, Flutterwave v3 Standard for NGN deposits, ExchangeRate-API for NGN/USD conversion, CoinGecko for crypto/USD quotes, and Resend for fictional preview emails.

## Completed

- Project: **morphly**, `iwausfzgitoehqecrvxc`.
- As requested, cleared 53 old application tables, their obsolete functions/triggers, and 709 active Auth users. Old sessions and refresh tokens were cleared too.
- Preserved private row snapshots and object metadata in `codex_backup_20261106`. These contain sensitive account data, are inaccessible to browser roles, and are not a tested full-project restore or off-site backup.
- Left Supabase system schemas, existing Storage files, project settings, deployed Edge Functions, and external scheduled jobs in place.
- Installed six `prank_*` tables with RLS and service-only financial functions. Bootstrap SQL: `database/schema.sql`, already applied to morphly. Do not rerun it there.
- Created an ignored `.env` with the project URL and publishable key. Private credentials remain blank.

## Configure credentials

Edit `.env` locally. Never put private keys in frontend JavaScript or `VITE_` variables.

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | Already set to morphly |
| `SUPABASE_PUBLISHABLE_KEY` | Already set; browser-safe |
| `SUPABASE_SECRET_KEY` | Supabase secret key or legacy service-role key; server only |
| `FLW_SECRET_KEY` | Flutterwave **v3** secret key; use a test key first |
| `FLW_WEBHOOK_SECRET` | Random secret, also set as Flutterwave webhook secret hash |
| `RESEND_API_KEY` | Resend sending key |
| `RESEND_FROM` | Your verified sender, e.g. `2winprankz <previews@yourdomain.com>` |
| `COINGECKO_API_KEY` | Optional CoinGecko Demo API key |
| `APP_ORIGIN` | Local: `http://127.0.0.1:5173`; production: public HTTPS origin without trailing slash |
| `PORT` | Production Node port, default `3000` |

Supabase Authentication URL Configuration must allow the app's `/auth` email redirect. Set the site URL, enable email/password signup and email confirmation, and configure production Auth SMTP. Auth confirmation emails are separate from app preview emails. Review inherited Morphly Auth hooks, CAPTCHA requirements, and email templates before enabling customer signup.

Flutterwave webhook URL: `https://YOUR_DOMAIN/api/webhooks/flutterwave`. Set its secret hash to `FLW_WEBHOOK_SECRET` and enable webhook retries. This integration uses v3's `verif-hash`, then independently verifies the transaction. Do not mix v4 credentials/webhook formats. For local sandbox testing, use your own HTTPS tunnel and set `APP_ORIGIN` to its public origin.

## Run

Requires Node 22.12 or later.

```powershell
npm.cmd install
npm.cmd run dev
```

Open `http://127.0.0.1:5173/auth`. Restart after editing `.env`.

Production serves the built site and API from one Node process:

```powershell
npm.cmd run build
# Set APP_ORIGIN to the public HTTPS origin in the deployment environment.
$env:NODE_ENV = 'production'
npm.cmd start
```

Use a persistent Node host behind HTTPS. A static-only upload does not run the API or worker. Keep at least one Node process alive. Multiple workers use database row locks and email leases. Do not expose the Vite development server publicly.

## Money and delivery behavior

1. Wallet API requests validate a Supabase access token. Users need confirmed, non-anonymous accounts.
2. Deposits are entered in NGN. The server stores the NGN charge, API rate, and USD credit before checkout. Users review both currencies. USD credits round down to cents. Deposits must be NGN 100–1,000,000.
3. The browser return and signed webhook independently verify successful status, currency, transaction ID, reference, and exact amount with Flutterwave. Only the stored USD value is credited. Replays cannot credit twice.
4. The free currency endpoint updates daily, is cached for one hour, and is rejected if older than 48 hours. This is not a per-second FX feed. Deposit quotes expire after 10 minutes before checkout; a started checkout retains its stored conversion. Provider attribution is included in the deposit screen.
5. Transfer previews use CoinGecko USD pricing and charge **1% of the USD value**, rounded to cents. Only the service fee is deducted; no cryptocurrency moves. Quotes expire after two minutes; fees rounding below one cent are rejected.
6. Confirmation atomically debits the service fee and creates a durable email job. Repeated confirmations cannot debit again. Emails remain visibly fictional, sent from the app's verified sender.
7. A first, definite email rejection refunds the fee once. Timeouts/ambiguous results retain the pending debit and retry the identical payload and idempotency key. After 20 hours, jobs enter `review` to avoid retrying beyond Resend's idempotency window. Check Resend before deciding on a manual refund; do not blindly resend.
8. Wallet activity shows recent deposits and delivery states. `sent` means provider acceptance, not guaranteed inbox delivery.

Mismatched, overpaid, refunded, or disputed payments need operational reconciliation. This version does not automatically refund Flutterwave funds or process chargebacks. Wallet funds are service credits with no withdrawal endpoint. If checkout creation fails after sending the request, create a fresh quote rather than repeatedly creating links for the same reference. Enable Flutterwave webhook retries for delayed payments.

## API

Except `/api/config` and the signed webhook, routes require a Supabase bearer token. Browser roles cannot write financial tables or execute financial RPCs. Authenticated direct reads only return the owner's rows. Per-account limits: 30 POSTs and 120 GETs per minute. Add edge/IP limits for your deployment and periodically prune `prank_rate_limits` rows older than a day.

| Route | Purpose |
| --- | --- |
| `GET /api/config` | Public Supabase configuration only |
| `GET /api/wallet` | USD balance |
| `GET /api/history` | Latest 50 deposits, transfers, and ledger entries each |
| `POST /api/deposits/quote` | `{amount, requestKey}`; NGN amount and UUID request key |
| `POST /api/deposits/checkout` | `{id}`; quote ID, returns checkout URL |
| `POST /api/deposits/verify` | `{transactionId, reference}` |
| `POST /api/webhooks/flutterwave` | Flutterwave v3 webhook |
| `POST /api/transfers/preview` | `{requestKey, platform, coin, amount, network, address, email}` |
| `POST /api/transfers/confirm` | `{id}`; atomic debit and email queue |
| `GET /api/transfers/:id` | Delivery state and balance |

## Verification

```powershell
npm.cmd test
npm.cmd run build
```

Tests use the real SQL schema in PGlite and HTTP handlers with mocked providers. They cover account isolation, direct-write denial, payment mismatches, duplicate credits/debits, pricing, email retries, and refunds. A live morphly deposit replay check ran in a rolled-back transaction. No real payments were taken or recipient emails sent. Hosted checkout → webhook → credit → Resend still needs a sandbox test after private credentials are supplied. Browser automation was unavailable; local page/API delivery was checked over HTTP.

References: [Flutterwave Standard](https://developer.flutterwave.com/docs/flutterwave-standard-1), [verification](https://developer.flutterwave.com/docs/transaction-verification), [webhooks](https://developer.flutterwave.com/docs/webhooks), [ExchangeRate-API](https://www.exchangerate-api.com/docs/free), [Supabase Auth](https://supabase.com/docs/reference/javascript/auth-getuser), [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys).
