# EMA Web Portal — GitLab CI/CD

Pipelines typecheck, push an immutable image, then SSH and roll `ema-portal`.
The browser calls **https://ema-api.duckdns.org** (set on the server). CI never
uploads `.env`.

Same buttons as EMA: **deploy-test** and **deploy-production**.

TLS for `agent.emabbass.com` / `api.emabbass.com` is Caddy, started once — see
[EDGE.md](EDGE.md). Portal deploys do not recreate Caddy.

**Deploy EMA first** on that host so `ema_net` exists.

## GitLab variables

Inherit the group SSH keys, hosts, and registry token. On **this project only**:

| Variable | Value |
|---|---|
| `TEST_DEPLOY_PATH` | `/home/deploy/portal` |
| `TEST_ENVIRONMENT_URL` | `https://agent-test.emabbass.com` (optional) |
| `PROD_DEPLOY_PATH` | `/home/deploy/portal` |
| `PROD_ENVIRONMENT_URL` | `https://agent.emabbass.com` |

## Server file CI does not touch

```bash
mkdir -p /home/deploy/portal
cd /home/deploy/portal
# production
cat > .env.production <<'EOF'
EMA_PUBLIC_API_URL=https://ema-api.duckdns.org
NEXT_PUBLIC_DEFAULT_LOCALE=en
EOF
chmod 600 .env.production

# test server (different API host)
cat > .env.test <<'EOF'
EMA_PUBLIC_API_URL=https://api-test.emabbass.com
NEXT_PUBLIC_DEFAULT_LOCALE=en
EOF
chmod 600 .env.test
```

## First pipeline

1. DNS + Caddy ([EDGE.md](EDGE.md)).
2. CORS on EMA includes `https://agent.emabbass.com`.
3. Push this repo, then start **CI/CD → Pipelines → Run pipeline** (pushes do
   not start one). Wait for `test` and `build-image`.
4. Press **deploy-production** (or **deploy-test**).
5. Open `https://agent.emabbass.com` and log in. Chat uses
   `wss://api.emabbass.com/ws` through Caddy.
