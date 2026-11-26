# NairaTask

NairaTask is a Telegram Mini App for browsing administrator-published tasks.

## Project stack
- Static HTML, CSS and JavaScript; deployable from the repository root on Cloudflare Pages.
- Telegram Web App SDK for Mini App launch and identity verification.
- Supabase Postgres, Row Level Security and Edge Functions.

## Supabase project
- Project ref: qezdxvyndsudckmreqlk
- Region: eu-west-1
- Edge Function: telegram-verify

## Current database
The existing project already contains profiles, wallets, wallet_transactions, tasks, task_submissions, promo_codes, promo_redemptions, referrals, withdrawal_requests, admin_users, app_settings, audit_logs and daily_checkins. All these public tables have RLS enabled.

A database trigger named on_auth_user_created_nairatask now invokes public.handle_new_user() after a new Supabase Auth user is created, creating the matching profile and wallet. The trigger was verified after migration.

## Frontend status
- Branded loading splash and responsive Homepage.
- Telegram Mini App identity verification call.
- Published task list read from public.tasks.
- The frontend attempts Telegram verification and Supabase session creation. Wallet balance loading is implemented. Promo redemption, daily reward claims, referral workflows, task submissions and withdrawals are not yet fully implemented.
- Withdrawals are disabled in the existing app_settings.withdrawal_rules configuration. No payout flow is implemented.
- No fake balances or fabricated task records are shown.

## Security notes
- The browser contains only the Supabase publishable key. Never place a Supabase service-role/secret key or Telegram bot token in frontend files.
- The telegram-verify Edge Function currently verifies Telegram initData but returns sessionExchange: not_configured. It does not create a Supabase Auth session.
- RLS policies restrict user-specific data to authenticated users. Keep this restriction; do not expose wallets, profiles, referral records or withdrawal data to anon clients.
- Admin task creation must be authenticated and checked against public.admin_users on the server. Do not add a public INSERT policy to tasks.
- Real-money payout integration must remain disabled until the operator has the required legal, age and payment-provider arrangements.

## Deploy
Use Cloudflare Pages connected to `demolacrown/NairaTask`, production branch `main`, root directory `/`, no build command, and output directory `/`. Confirm the Pages project is linked to this exact repository and branch. CSS and JS asset URLs are versioned to reduce stale browser-cache issues.
