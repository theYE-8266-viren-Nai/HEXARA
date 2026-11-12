# Horizon

Minimal React + Supabase starting point for the Horizon research demo.

## Setup

1. Run `npm install`.
2. Copy `.env.example` to `.env.local`.
3. Add the hosted Supabase URL and publishable key.
4. Run `npm run dev`.

The current page is intentionally a connection smoke test, not the product UI.
All data must remain synthetic. Never commit `.env.local` or service-role keys.

## Assumed devices and health signals

Horizon analyzes readings; it does not measure anything. Real hardware is not connected, so every signal is assumed to arrive from an imagined crew wearable plus a personal dosimeter. See [docs/device-assumptions.md](docs/device-assumptions.md) (generated with `npm run docs:assumptions`).
