# Vercel deployment

Prepared project: [2winprankz](https://vercel.com/lus-projects-b2662b64/2winprankz) under **lu's projects**. Project ID: `prj_d0HDQbfcQ4ZldcGRAhbvEMdDloJf`. No deployment has been published yet.

The Vercel adapter in `api/index.mjs` runs the existing API without the persistent Node server. `vercel.json` configures the Vite build, clean URLs, bundled email logos, and a once-per-minute Pro cron at `/api/jobs/email`. Immediate email work is registered using `waitUntil`; the cron handles later retries. Existing Supabase transactions, leases, and idempotency protection are reused.

Already configured in Vercel: Supabase URL, browser publishable key, and a generated private `CRON_SECRET` (production and preview). No private provider credentials were copied from other projects.

## Required before activation

Add these in [Vercel Environment Variables](https://vercel.com/lus-projects-b2662b64/2winprankz/settings/environment-variables), with Production and the intended Preview environment selected. Use secret/sensitive variables for keys.

- `SUPABASE_SECRET_KEY`: morphly's Supabase server secret or legacy service-role key.
- `FLW_SECRET_KEY`: Flutterwave v3 secret key; start with sandbox credentials.
- `FLW_WEBHOOK_SECRET`: random secret also set as Flutterwave's webhook secret hash.
- `RESEND_API_KEY`: Resend sending key.
- `RESEND_FROM`: sender address on your verified domain.
- `APP_ORIGIN`: the final public site origin, without a trailing slash. Set this after confirming the deployment domain.

The optional `COINGECKO_API_KEY` is a CoinGecko Demo API key. Vercel authentication does not supply Supabase, Flutterwave, or Resend private keys. Do not paste credentials into chat or commit them.

Configure Supabase's allowed `/auth` email redirect for the deployment domain. Set Flutterwave's webhook to `https://YOUR_DOMAIN/api/webhooks/flutterwave` and enable retries. These provider callbacks and Vercel's scheduler must be able to reach the production endpoints; deployment protection must not block them. Keep private previews protected, and point payment webhooks only to the intended production or sandbox environment.

Deploy the repository root, with `npm run build` and output `dist`. Do not deploy only the `flashlab-homepage` folder, because the API lives at the repository root. Exclude `.env` files; `.vercelignore` is provided. There is no need to run `npm start` on Vercel. Vercel runs the API function and cron itself.

After publishing, check `/api/config`, account signup/login, one sandbox Flutterwave checkout, verified credit, the 1% fee debit, email acceptance, and the cron's logs. Never test a real charge or send to a real recipient as part of an automated deployment check.

Run `npm test` and `npm run build` before publishing. The local Node deployment described in `BACKEND_SETUP.md` remains available.


All `/api/:path*` requests are explicitly rewritten to the single API entrypoint. The entrypoint restores the requested API path from the rewrite query before authentication and routing, preserving ordinary query parameters. This covers nested transfer, deposit, admin, webhook and job routes; relying on the bracketed filename alone did not route nested paths in this deployment.
