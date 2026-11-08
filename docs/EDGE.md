# TLS edge — agent, api, and whatsapp.emabbass.com

Caddy sits in front of the three public apps. Browsers and Meta only see **443**.
Postgres, Redis, and the container ports stay on Docker network `ema_net`.

Caddy auto-issues Let's Encrypt certificates. Nginx or Traefik can do the same
job; Caddy is the smallest config that does HTTPS correctly (WebSocket included).

Meta’s webhook is **`https://whatsapp.emabbass.com/webhook`**. Do not point it at
`api.emabbass.com` or `agent.emabbass.com`.

## DNS (at your registrar)

Point these names at the **production** server public IP:

| Name | Type | Value |
|---|---|---|
| `agent.emabbass.com` | A | production server IP |
| `api.emabbass.com` | A | same production server IP |
| `whatsapp.emabbass.com` | A | same production server IP |

Optional test server:

| `agent-test.emabbass.com` | A | test server IP |
| `api-test.emabbass.com` | A | test server IP |
| `whatsapp-test.emabbass.com` | A | test server IP |

Wait until `dig +short agent.emabbass.com` returns that IP before starting Caddy.

## Firewall

```bash
# as root
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

Do not publish Postgres or Redis. After Caddy works, stop exposing EMA on
`0.0.0.0:4000`:

```bash
# /home/deploy/ema-api/.env.production (or .env.test)
EMA_BIND=127.0.0.1
```

Then recreate **only** `ema-api` (not Postgres/Redis). Caddy still reaches it as
`ema-api:4000` on `ema_net`. Host `curl` can use `127.0.0.1:4000`.

## Start Caddy (once per server)

```bash
sudo -u deploy mkdir -p /home/deploy/edge
# copy edge/Caddyfile and edge/docker-compose.yml from this repo
cd /home/deploy/edge
cp .env.example .env   # if you copied the example
# edit ACME_EMAIL, AGENT_HOST, API_HOST, WHATSAPP_HOST
chmod 600 .env
docker compose --env-file .env up -d
docker logs ema-edge
```

Caddy must start **after** `ema_net` exists (deploy EMA first). Portal and
WhatsApp can come up after; Caddy will log upstream errors until those
containers exist.

After Caddy proxies WhatsApp, bind the bridge to localhost only:

```bash
# /home/deploy/whatsapp-api/.env.production
WHATSAPP_BIND=127.0.0.1
```

Then recreate `whatsapp-bridge`. Meta keeps using `https://whatsapp.emabbass.com/webhook`.

## EMA CORS

On the API server, `config/application.yml` must allow the portal origin:

```yaml
ema:
  cors:
    allowed-origins:
      - https://agent.emabbass.com
```

On the test API host add `https://agent-test.emabbass.com`. Recreate `ema-api`
after editing. CI does not upload this file.
