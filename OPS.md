# Operatività sul tuo hardware

Questo stack gira solo sul PC dove hai Docker.

## Avvio

```bash
cd ~/Pictures/hre-engine
git pull
docker compose up -d
docker compose ps
```

- UI: http://127.0.0.1:3000
- Postgres: solo localhost porta 5432

## Password

Copia `.env.example` in `.env` e cambia `POSTGRES_PASSWORD`. Poi `docker compose up -d`.

## Accesso da telefono (solo tue reti)

1. Tailscale sul PC e sul telefono (account tuo).
2. Dal telefono `http://IP-TAILSCALE:3000`.
3. Non aprire la 5432 sul router.

## Impianto FV / GSE

Portali del tuo inverter e del tuo GSE con SPID. Nessun accesso a impianti di terzi.
