# Quant Screening Dashboard

A research dashboard for screening NSE equities and reviewing explainable SMMA crossover signals using liquidity, ETQ/LTQ, market depth, and transparent quantitative scoring.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/quant-screening-dashboard/` — runnable dashboard artifact and source UI
- `quant_engine/stock_engine.py` — broker-agnostic Python reference engine
- `quant_engine/README.md` — live-feed normalization and Windows executable notes

## Architecture decisions

- Demo mode is the default so the dashboard can be reviewed without trading credentials.
- The Python engine accepts normalized ticks, keeping broker-specific authentication and websocket code out of the signal logic.
- Signal scoring is explainable and deliberately baseline-oriented until labeled crossover outcomes are collected.

## Product

- Live-ready screening cockpit with a safe demo feed for presentation and development
- ₹30–₹500 LTP range and >10 lakh bid/ask liquidity filters
- SMMA(20/120), ETQ windows, average LTP windows, market depth, and signal journal
- Explainable ACCEPT / WATCH / AVOID decisions based on LTQ burst, order imbalance, spread, and trend follow-through

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
