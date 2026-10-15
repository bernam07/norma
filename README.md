# Norma

Norma is a minimalist daily capture application designed to reduce context switching and information overload. Capture fleeting ideas, tasks, and web references throughout the day with zero friction. Every morning, Norma compiles your unread queue into a clean, structured email digest delivered directly to your inbox.

---

## Overview

Most note-taking applications demand categorization, tags, folders, and maintenance during working hours, pulling you out of deep focus. Norma acts as an ephemeral scratchpad:

- Write thoughts quickly without organizational overhead.
- Your queue stays clean and distraction-free.
- An automated briefing arrives in your inbox every morning at 07:00.
- All delivered notes are archived with date grouping and one-click Markdown export for Obsidian, Notion, or local storage.

---

## Key Features

### Multi-User Architecture
- User registration and login powered by a chosen username and a 6 to 10 digit numeric PIN.
- Cryptographic PIN derivation using Node.js `scrypt` with individual random 16-byte salts.
- Session tokens signed with HMAC-SHA256 via Web Crypto, verified asynchronously in Edge Middleware.
- Complete multi-tenant data isolation: all notes, archives, and queues are strictly filtered by user ID.

### Resend Email Integration & Guided Onboarding
- Each user manages their own delivery address and Resend API key directly from the Settings page.
- In-app setup guide with step-by-step instructions for connecting a free Resend account (3,000 free emails/month).
- Instant "Send Test Email" tool with live validation and diagnostic feedback.
- Automated morning delivery via Vercel Cron, iterating per user with isolated error boundaries.

### Offline-First Progressive Web App (PWA)
- Installable on desktop and mobile devices via standard Service Worker and Web App Manifest.
- Instant interface loading from local storage cache.
- Full offline capture support using browser IndexedDB storage.
- Automatic background synchronization when the network connection is restored.

### Browser Extension (Quick Capture)
- Chromium extension for Google Chrome, Microsoft Edge, and Brave.
- Instant capture popup with keyboard shortcut (`Ctrl + Enter` or `Cmd + Enter`).
- One-click active tab capture, automatically formatting the current web page title and URL into Markdown.
- Context menu options: right-click any page selection to save directly to your queue.
- Authenticated via personal API token (`nr_usr_...`) generated on your Settings page.

### Fast Capture UI & Modal Editing
- Distraction-free capture input with auto-focus.
- Quick pop-up modal for inline editing and note management without leaving the dashboard.
- Manual "Send Digest Now" button for immediate queue dispatch.
- Grouped archive view with search filtering, daily Markdown copy, and full `.md` file download.

---

## Security Model

Norma implements defense-in-depth principles across all application layers:

1. **Authentication & Session Hardening**:
   - Numeric PINs (6 to 10 digits) are hashed with unique salts using `crypto.scryptSync`.
   - Signed session cookies (`norma_session`) enforce `HttpOnly`, `SameSite=Strict`, `Path=/`, and conditional `Secure` flags.
   - Enforced production check: the system refuses to run in production if `AUTH_SECRET` is missing.

2. **Rate Limiting & Anti-Brute-Force**:
   - Sliding-window in-memory rate limiter on authentication endpoints.
   - Login rate limit: max 10 requests per minute per IP, max 5 attempts per minute per account.
   - Account creation rate limit: max 5 registrations per 15 minutes per IP.
   - Email test rate limit: max 3 test emails per 5 minutes per user.

3. **Storage & Multi-Tenant Privacy**:
   - All database note queries enforce a validated UUID `userId` and fail closed (`[]` or `null`) if invalid.
   - Client-side storage (`localStorage` and `sessionStorage`) is purged upon session logout or 401 Unauthorized responses, preventing data leakage on shared workstations.

4. **HTTP Security Headers**:
   - `Content-Security-Policy`: Restricts scripts, styles, fonts, frames (`frame-ancestors 'none'`), and connection endpoints.
   - `Strict-Transport-Security` (HSTS): Enforces HTTPS connections for 2 years.
   - `X-Frame-Options: DENY`: Prevents clickjacking attacks.
   - `X-Content-Type-Options: nosniff`: Prevents MIME-type sniffing.
   - `Referrer-Policy: strict-origin-when-cross-origin`.

---

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL (`pg` connection pool with SSL)
- **Email Delivery**: Resend SDK
- **Icons**: Lucide React
- **Client Storage**: IndexedDB + LocalStorage

---

## Project Structure

```
norma/
├── app/
│   ├── api/
│   │   ├── archive/              # Paginated processed notes retrieval
│   │   ├── auth/
│   │   │   ├── login/            # Rate-limited authentication
│   │   │   ├── logout/           # Session cookie invalidation
│   │   │   ├── me/               # Authenticated profile and settings status
│   │   │   └── register/         # Account creation with username + PIN
│   │   ├── cron/
│   │   │   └── daily-briefing/   # Automated scheduled email dispatch
│   │   ├── digest/
│   │   │   └── send/             # On-demand manual digest dispatch
│   │   ├── notes/                # CRUD endpoints for queue notes
│   │   └── settings/             # User preferences & test email sender
│   ├── archive/                  # Searchable history and Markdown export page
│   ├── login/                    # Unified Sign In / Create Account page
│   ├── settings/                 # Resend configuration, token & security page
│   ├── layout.tsx                # Root layout, meta tags and viewport settings
│   └── page.tsx                  # Main capture queue dashboard
├── db/
│   └── schema.sql                # PostgreSQL table definitions and indexes
├── extension/                    # Chromium quick capture extension
│   ├── manifest.json             # Manifest V3 configuration
│   ├── background.js             # Context menu and service worker
│   ├── popup/                    # Extension UI and quick capture script
│   └── icons/                    # Extension assets
├── lib/
│   ├── auth.ts                   # Edge-safe token verification & validation
│   ├── pin.ts                    # Server-side scrypt PIN hashing & verification
│   ├── db.ts                     # Database connection pool and scoped queries
│   ├── email.ts                  # Digest HTML generator and Resend sender
│   ├── export-markdown.ts        # Obsidian/Notion Markdown formatter
│   ├── offline-db.ts             # IndexedDB wrapper for offline storage
│   ├── rate-limit.ts             # Sliding-window rate limiting engine
│   └── session.ts                # Unified session & API token resolver
├── middleware.ts                 # Edge request authentication and routing
├── next.config.mjs               # Security headers, CSP and compiler config
└── vercel.json                   # Daily briefing cron schedule
```

---

## Getting Started

### Prerequisites

- Node.js 18.17.0 or higher
- A running PostgreSQL database instance (local, Vercel Postgres, Neon, Supabase, or AWS RDS)
- A free account on [Resend](https://resend.com) (for email delivery)

### 1. Clone Repository

```bash
git clone https://github.com/your-username/norma.git
cd norma
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Variables

Create a local environment file based on `.env.example`:

```bash
cp .env.example .env.local
```

Configure the following variables in `.env.local`:

| Variable | Required | Description |
| :--- | :---: | :--- |
| `POSTGRES_URL` | Yes | PostgreSQL connection string (e.g., `postgres://user:pass@host:5432/dbname?sslmode=require`). |
| `AUTH_SECRET` | Yes | High-entropy secret string (at least 32 characters) used to sign HMAC session tokens. |
| `CRON_SECRET` | Yes | Secret token authorizing scheduled requests from Vercel Cron. |
| `RESEND_API_KEY` | Optional | Fallback Resend key for single-tenant mode (individual users configure their own in Settings). |
| `USER_EMAIL` | Optional | Fallback delivery email address. |
| `FROM_EMAIL` | Optional | Default sender address (defaults to `Norma Digest <onboarding@resend.dev>`). |

### 4. Database Setup

Norma automatically verifies and provisions required tables (`users`, `notes`) and schema migrations upon startup. To run the schema manually against your database:

```bash
npm run db:migrate
```

Or execute `db/schema.sql` directly using your PostgreSQL client.

### 5. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Deployment to Vercel

1. Push your repository to GitHub.
2. Import the project in the [Vercel Dashboard](https://vercel.com).
3. Set your Production Environment Variables (`POSTGRES_URL`, `AUTH_SECRET`, `CRON_SECRET`).
4. Deploy.

### Scheduled Cron Briefings

The automated briefing is preconfigured in `vercel.json` to trigger every morning at 07:00 UTC:

```json
{
  "crons": [
    {
      "path": "/api/cron/daily-briefing",
      "schedule": "0 7 * * *"
    }
  ]
}
```

Vercel Cron automatically includes the `Authorization: Bearer <CRON_SECRET>` header with requests.

---

## Browser Extension Installation

1. Open your Chromium-based browser (Chrome, Edge, Brave).
2. Navigate to extensions settings:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
   - Brave: `brave://extensions`
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** and select the `extension` folder inside this repository.
5. Click the extension icon in your toolbar, open **Settings** (gear icon), and enter:
   - **Norma URL**: Your deployed domain (e.g., `https://norma.vercel.app` or `http://localhost:3000`).
   - **Personal API Key**: Copied from your Norma **Settings** page (`nr_usr_...`).
6. Save settings. You can now capture notes from any webpage using `Ctrl + Enter` or right-click.

---

## Scripts

| Command | Action |
| :--- | :--- |
| `npm run dev` | Starts local Next.js development server. |
| `npm run build` | Compiles optimized production build and validates types. |
| `npm start` | Starts Next.js production server. |
| `npm run lint` | Runs Next.js ESLint validation. |
| `npm run db:migrate` | Runs PostgreSQL database migration script. |

---

## License

This project is licensed under the MIT License.
