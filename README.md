# Hybrid Reconciliation Engine (HRE)

Control plane ISO 20022 + ledger PostgreSQL + listener Arbitrum One (ETH e ERC-20).

## Cosa gira dove

| Componente | Dove |
|---|---|
| Dashboard + API `health` / `pain001` | Netlify (CDN globale) |
| Schema e journal ACID | PostgreSQL 15+ |
| Block listener ETH+USDC+USDT | Processo Node persistente (`npm run listen`) |
| Parser camt.054 | Processo Python (`src/reconciliation_engine.py`) |

Il listener e la riconciliazione bancaria non vivono solo su CDN: servono RPC, DB e un processo long-running. La chiave privata va solo on-premise.

## Setup DB

```bash
psql "$DATABASE_URL" -f schema.sql
```

## Listener L2

```bash
export DATABASE_URL=postgres://...
export ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
npm i
npm run listen
```
