# ShipLog

AI-powered changelog platform. Turn your GitHub activity into customer-facing changelogs automatically.

## Tech Stack

- **Next.js 15** (App Router) + TypeScript
- **PostgreSQL** via Neon + Drizzle ORM
- **NextAuth.js v5** (GitHub OAuth)
- **Tailwind CSS** + shadcn/ui
- **Anthropic Claude** for AI generation
- **Stripe** for billing
- Deployed on **Vercel**

## Getting Started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Fill in the required values:

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `GITHUB_CLIENT_ID` | GitHub OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App client secret |
| `AUTH_SECRET` | Random secret for NextAuth (`openssl rand -base64 32`) |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |

### 3. Set up the database

```bash
pnpm db:push      # push schema to DB (development)
# or
pnpm db:generate  # generate migration files
pnpm db:migrate   # run migrations
```

### 4. Run the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
app/                  # Next.js app directory (routes)
  api/auth/           # NextAuth route handler
db/
  schema.ts           # Drizzle schema
  migrations/         # Generated SQL migrations
lib/
  auth.ts             # NextAuth config
  db.ts               # Database client
```

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start dev server with Turbopack |
| `pnpm build` | Production build |
| `pnpm lint` | Run ESLint |
| `pnpm format` | Format with Prettier |
| `pnpm db:push` | Push schema changes to database |
| `pnpm db:generate` | Generate migration files |
| `pnpm db:migrate` | Run pending migrations |
| `pnpm db:studio` | Open Drizzle Studio |
