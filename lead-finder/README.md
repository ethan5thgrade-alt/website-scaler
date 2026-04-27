# NoSiteLeads

A subscription SaaS that helps web designers / agencies find local businesses
that don't have a real website yet. Users enter a ZIP code and a business
category, and the app returns a clean list of leads with phone numbers, email
(best-effort), ratings, and review counts — plus a one-click AI pitch-email
generator.

It's a Node port of the Python lead-finder script, wrapped with auth, Stripe
subscription billing, a SQLite database for searches/leads, and a small
frontend.

## Stack

- **Backend:** Node.js + Express + better-sqlite3
- **Auth:** sessions (express-session) + bcrypt
- **Billing:** Stripe Checkout + Customer Portal + webhooks
- **Lead source:** Google Places API (New) — text search
- **Pitch emails:** Anthropic Claude (with a built-in fallback template if no key)
- **Frontend:** vanilla HTML/CSS/JS

## Setup

```bash
cd lead-finder
cp .env.example .env
# Fill in keys (see below)
npm install
npm start
```

Open http://localhost:3000.

### Required environment variables

| Var                       | What it's for                                                  |
|---------------------------|----------------------------------------------------------------|
| `SESSION_SECRET`          | Long random string for session cookies                         |
| `GOOGLE_PLACES_API_KEY`   | Enable "Places API (New)" in Google Cloud Console              |
| `ANTHROPIC_API_KEY`       | Optional. If unset, pitch emails use a baked-in template.      |
| `STRIPE_SECRET_KEY`       | `sk_test_...` or `sk_live_...`                                 |
| `STRIPE_PRICE_ID`         | The recurring price ID for your $49/mo plan                    |
| `STRIPE_WEBHOOK_SECRET`   | From `stripe listen` or your dashboard webhook endpoint        |
| `APP_URL`                 | Public URL (e.g. `http://localhost:3000`) for Stripe redirects |
| `DEV_BYPASS_BILLING`      | `true` to skip Stripe entirely while developing                |

### Stripe webhook (local dev)

```bash
stripe listen --forward-to localhost:3000/api/billing/webhook
```

Copy the `whsec_...` it prints into `STRIPE_WEBHOOK_SECRET`.

## How filtering works

Same logic as the Python original:

- Excludes businesses with a real website
- Keeps businesses whose only "website" is a social link (Facebook, IG,
  Linktree, Yelp, etc.) — those are great leads
- Filters out: <3 reviews, >500 reviews (chains), <3.0 rating, no phone,
  permanently-closed listings

## Routes

| Method | Path                              | Purpose                              |
|--------|-----------------------------------|--------------------------------------|
| GET    | `/`                               | Marketing landing page               |
| GET    | `/login`                          | Sign in / sign up                    |
| GET    | `/app`                            | Dashboard (requires login)           |
| POST   | `/api/auth/register`              | Create account                       |
| POST   | `/api/auth/login`                 | Log in                               |
| POST   | `/api/auth/logout`                | Log out                              |
| GET    | `/api/auth/me`                    | Current user + subscription status   |
| POST   | `/api/billing/checkout`           | Start Stripe Checkout                |
| POST   | `/api/billing/portal`             | Open Stripe Customer Portal          |
| POST   | `/api/billing/webhook`            | Stripe → us                          |
| GET    | `/api/business-types`             | Allowed business categories          |
| POST   | `/api/search`                     | Run a ZIP+type search (subscribed)   |
| GET    | `/api/searches`                   | List recent searches                 |
| GET    | `/api/searches/:id`               | Get a search and its leads           |
| GET    | `/api/searches/:id/csv`           | Download leads as CSV                |
| POST   | `/api/leads/:id/pitch`            | Generate a pitch email               |

## Notes

- Email enrichment is best-effort: when a business has only a social link, we
  fetch the page and look for a `mailto:` or plain email address. Many social
  pages are JS-rendered and won't yield one. That's expected — phone is the
  reliable contact channel for these leads.
- Google Places caps text search at ~60 results, so each search returns up to
  60 raw places before filtering.
