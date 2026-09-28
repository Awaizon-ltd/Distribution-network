# Awarizon Distribution Network: API

The backend for Awarizon's **testnet distribution network**: a Web3 farming platform where users sign in with their wallet, activate nodes, complete missions, earn points, refer friends and climb the rankings.

## Features

- **Wallet authentication:** nonce signing with JWT access and refresh tokens
- **Nodes:** activation, scoring and reputation history
- **Missions:** tasks and verified completions that award points
- **Points ledger:** every award and deduction is recorded as a transaction
- **Referrals:** referral codes and rewards, with a background sweep for stuck referrals
- **Rankings:** leaderboards recalculated by a worker, with weekly resets
- **Achievements, notifications and news**
- **Social connections** and a **creator programme** with content submissions
- **Admin module:** system configuration and an audit log
- Interactive API docs (Swagger UI)

## Tech stack

| Layer | Technology |
|---|---|
| Runtime | Node.js, TypeScript, Express |
| Database | PostgreSQL through Prisma ORM |
| Queue / cache | Redis, BullMQ workers |
| Web3 | ethers, viem |
| Validation / security | Zod, helmet, rate limiting and slow-down, JWT, bcrypt |
| Docs / logging | swagger-jsdoc, swagger-ui-express, winston, morgan |

## Getting started

```bash
git clone https://github.com/Awaizon-ltd/Distribution-network.git
cd Distribution-network
npm install
# create .env (see below)
npm run prisma:generate
npm run prisma:migrate:dev
npm run prisma:seed            # optional seed data

npm run dev                    # API server (tsx watch)
npm run worker                 # background workers, in a second terminal
```

| Script | Purpose |
|---|---|
| `npm run build` / `npm start` | Compile to `dist/` and run |
| `npm run worker:start` | Run the compiled workers |
| `npm run prisma:migrate` | Apply migrations in production |
| `npm run prisma:studio` | Browse the database |
| `npm run typecheck` / `npm run lint` | Static checks |

## Environment variables

| Group | Variables |
|---|---|
| Server | `PORT`, `NODE_ENV`, `API_VERSION`, `CORS_ORIGINS`, `FRONTEND_URL`, `LOG_LEVEL` |
| Data | `DATABASE_URL`, `REDIS_URL`, `BULL_CONCURRENCY` |
| Auth | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`, `NONCE_EXPIRY_SECONDS` |
| Rate limiting | `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS` |
| Rewards | `NODE_ACTIVATION_POINTS`, `REFERRAL_REWARD_POINTS` |
| Cache TTLs | `USER_CACHE_TTL`, `LEADERBOARD_CACHE_TTL`, `MISSIONS_CACHE_TTL`, `NEWS_CACHE_TTL` |

## Background workers

`src/jobs/workers/`: `achievement`, `notification`, `ranking`, `referral`, `referralSweep` and `weeklyReset`.

## Deployment

Two processes: the API (`Dockerfile`) and the workers (`Dockerfile.worker`). Both need PostgreSQL and Redis. A `nixpacks.toml` is included for Railway.

## Project structure

```
src/
├── app.ts  server.ts
├── modules/       # auth, users, nodes, missions, points, referrals, rankings, achievements,
│                  # notifications, news, socials, creator, admin
├── jobs/          # BullMQ worker entry and workers
├── queue/  cache/  database/  middleware/  config/  utils/
prisma/            # schema.prisma, migrations, seed
scripts/           # One-off maintenance scripts
```
