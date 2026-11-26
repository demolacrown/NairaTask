# NairaTask

NairaTask is a Telegram Mini App for browsing administrator-published tasks.

## Project stack
- Static HTML, CSS and JavaScript; deployed from the repository root on Cloudflare Pages.
- Telegram Web App SDK for Mini App launch and identity verification.
- Supabase Postgres, Row Level Security and Edge Functions.

## Supabase project
- Project ref: qezdxvyndsudckmreqlk
- Region: eu-west-1
- Active Edge Functions: `telegram-verify`, `telegram-bot`, `admin-check`, `admin-management`.

## Current database
The project contains profiles, wallets, wallet_transactions, tasks, task_submissions, promo_codes, promo_redemptions, referrals, withdrawal_requests, admin_users, app_settings, audit_logs and daily_checkins. Public tables have RLS enabled.

A database trigger named `on_auth_user_created_nairatask` invokes `public.handle_new_user()` after a new Supabase Auth user is created, creating the matching profile and wallet.

## Frontend status
- Branded loading splash, intro animation and responsive Homepage.
- Telegram Mini App identity verification and Supabase session exchange are implemented in the deployed `telegram-verify` Edge Function.
- Published task list read from `public.tasks`.
- Wallet balance loading is implemented for signed-in users.
- Homepage promo code redemption and daily reward claims are connected to authenticated database functions. A promo code must be active and available to redeem.
- Referral workflows and task submissions are not yet fully implemented.
- Withdrawals are disabled in the existing `app_settings.withdrawal_rules` configuration. No payout flow is implemented.
- The admin interface calls the deployed `admin-check` and `admin-management` functions. An administrator account still needs to be assigned before the console can be used.
- No fake balances or fabricated task records are shown.

## Security notes
- The browser contains only the Supabase publishable key. Never place a Supabase service-role/secret key or Telegram bot token in frontend files or GitHub.
- `telegram-verify` validates Telegram initData, rejects replayed or expired payloads, creates or finds the matching Supabase Auth user, and returns a Supabase session.
- `admin-check` and `admin-management` validate the authenticated user and check `public.admin_users` on the server.
- RLS policies restrict user-specific data to authenticated users. Keep this restriction; do not expose wallets, profiles, referral records or withdrawal data to anon clients.
- Real-money payout integration must remain disabled until the operator has the required legal, age and payment-provider arrangements.
- Deployed Edge Function source is currently managed in Supabase and has not yet been mirrored into this GitHub repository. Do not commit secret values.

## Deploy
The existing Cloudflare Pages project `nairatask` was created using Direct Upload and remains at https://nairatask.pages.dev. The repository includes a GitHub Actions workflow at `.github/workflows/deploy-cloudflare.yml` that deploys the repository root to this existing Pages project on pushes to `main`. It requires the GitHub Actions repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.


## Referral programme
- Every profile receives a unique `NT` referral code.
- A signed-in invitee can apply a code once; self-referrals are rejected.
- Only the inviter is eligible for the ₦100 reward.
- Qualification requires five approved task submissions in the `rewarded_ad` category.
- On qualification, ₦100 is recorded as a pending wallet transaction. It is not added to available balance until the associated advertising revenue is verified and an administrator settles it.
- Referral attribution is handled by the authenticated `register_referral` database function. The Homepage displays the user's code and referral counts.
- Automatic attribution from Telegram deep links is supported when Telegram provides a `start_param` beginning with `ref_`; invitees can also enter a code manually.
- Real ad-view verification must come from the approved ad provider's server callback. A client-side timer or self-reported completion must never qualify a referral.
