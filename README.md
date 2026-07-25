# RiskFusion AI

### Security operations platform for banking incident correlation

RiskFusion AI unifies cybersecurity and transaction telemetry in one workspace so security
operations teams can investigate correlated threats with an explainable risk score behind
every decision. Every incident carries the signals that produced its score, an ordered audit
timeline, and MITRE ATT&CK mapping.

**Live:** <https://riskfusion-ai.vercel.app>

---

## Screens

| File | Page | Description |
|------|------|-------------|
| `index.html` | **Landing** | Public overview of the platform with a single call to action |
| `signin.html` | **Sign in** | Email/password and Google sign-in, backed by Supabase Auth |
| `callback.html` | **OAuth callback** | Completes the Google authorisation-code exchange |
| `dashboard.html` | **SOC Dashboard** | Live KPIs, risk distribution, activity stream, threat-origin map |
| `incidents.html` | **Incident Queue** | Table and board views, filters, bulk actions, pagination |
| `investigation.html` | **Investigations** | Investigation workspace with persisted analyst notes |
| `analytics.html` | **Analytics** | Severity, type, status, geography and model-performance analytics |
| `incident.html` | **Incident Details** | Risk gauge, correlated signals, timeline, response actions |
| `ai.html` | **AI Analyst Report** | Structured reasoning chain, confidence and MITRE mapping |
| `killchain.html` | **Attack Kill Chain** | Six-stage kill-chain timeline with detail panel |
| `config.html` | **Configuration** | Alert policy, account, password reset, service health |

---

## Architecture

```text
FineSpark/
├── *.html                       # Static pages, no build step
├── styles/design-system.css     # Design tokens and components
├── scripts/
│   ├── config.js                # Public runtime configuration
│   ├── auth.js                  # Supabase Auth client (GoTrue REST + PKCE)
│   ├── shell.js                 # Sidebar/topbar injection and route protection
│   ├── app.js                   # Shared UI utilities and sign-out
│   ├── api.js                   # Authenticated API client and shared controls
│   ├── live-state.js            # Cross-page live data bindings
│   └── risk-assessment.js       # Risk-engine panel rendering
├── api/index.py                 # Vercel serverless entry point
├── backend/app/
│   ├── main.py                  # FastAPI routes
│   ├── auth.py                  # Supabase JWT verification dependency
│   ├── store.py                 # Supabase data access (service role)
│   ├── schemas.py               # Request/response models
│   └── risk_engine/             # Weighted, explainable scoring rules
└── supabase/migrations/         # Schema and Row Level Security policies
```

**Data flow.** The browser holds a Supabase session and sends its access token on every API
request. The API verifies that token, then reads and writes `public.incidents` with the
service-role key. Row Level Security denies the anonymous role outright, so incident data is
never reachable directly from a browser.

---

## Authentication

Supabase Auth, accessed through its REST API so the static frontend needs no bundler:

- **Email and password** — sign in, sign up, and password reset.
- **Google** — Authorization Code flow with PKCE. The button appears only once the Google
  provider is actually enabled on the Supabase project, so the UI never offers a sign-in
  method that cannot complete.
- **Sessions** — access tokens refresh silently before expiry. "Keep me signed in" stores the
  session in `localStorage`; otherwise it lives in `sessionStorage` and dies with the tab.
- **Route protection** — every workspace page calls `requireSession()` before rendering and
  redirects to sign-in, preserving the requested destination so the user lands where they
  intended once authenticated.
- **Public surface** — `index.html` is the only indexable page; the sign-in form lives behind
  it at `signin.html`.
- **Sign out** — clears local state immediately and revokes the session server-side.

### Enabling Google sign-in

1. Google Cloud Console → **APIs & Services → Credentials → Create OAuth client ID** (Web).
2. Authorised redirect URI: `https://<your-project>.supabase.co/auth/v1/callback`.
3. Supabase → **Authentication → Providers → Google**: enable it and paste the client ID and
   secret.
4. Supabase → **Authentication → URL Configuration**: add `https://riskfusion-ai.vercel.app`
   as a site URL and `https://riskfusion-ai.vercel.app/callback.html` as a redirect URL.

The button becomes visible automatically once step 3 is saved.

---

## Configuration

Server-side variables (Vercel → Settings → Environment Variables), documented in
[`.env.example`](.env.example):

| Variable | Required | Purpose |
|---|---|---|
| `SUPABASE_URL` | yes | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Data access; bypasses RLS. **Secret.** |
| `SUPABASE_ANON_KEY` | yes | Token introspection fallback |
| `SUPABASE_JWT_SECRET` | recommended | Verifies access tokens locally, with no network hop |
| `ALLOWED_ORIGINS` | no | Comma-separated CORS allowlist |

The project URL and anon key also appear in `scripts/config.js`; both are publishable by
design and carry no privileges of their own. The service-role key must never appear there.

---

## Running locally

```bash
pip install -r backend/requirements.txt

SUPABASE_URL=https://<project>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
SUPABASE_JWT_SECRET=<jwt-secret> \
uvicorn app.main:app --reload --app-dir backend
```

Open `http://127.0.0.1:8000` — the API serves the frontend from the same origin, so requests
need no CORS configuration. API docs are at `/docs`.

---

## Database

Apply the migrations in [`supabase/migrations/`](supabase/migrations/) in order, via the
Supabase SQL editor or `supabase db push`. They create the `incidents` table, add incident
ownership, and lock the table down to authenticated access only.

---

## Security

- Content Security Policy restricting scripts, styles, frames and connections; `frame-ancestors 'none'`.
- `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`,
  `Strict-Transport-Security`, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`.
- Every data endpoint requires a verified Supabase access token; signature, expiry, audience
  and issuer are all checked.
- CORS restricted to known origins rather than `*`.
- Row Level Security denies the anonymous role; the API holds the only privileged credential.
- Incidents are never deleted — closing one is a status change, preserving the audit trail.

---

## Tech stack

HTML5 · vanilla CSS design system · vanilla JavaScript (no framework, no build step) ·
Chart.js v4 · FastAPI · Pydantic · Supabase (Postgres + Auth) · Vercel
