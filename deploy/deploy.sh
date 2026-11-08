#!/bin/sh
set -eu

image="${1:?immutable image reference is required}"
compose_file="${2:-docker-compose.prod.yml}"
env_file="${3:-.env.production}"
service="portal"
container="ema-portal"

if [ ! -f "$env_file" ]; then
    echo "Missing environment file: $env_file" >&2
    echo "Copy .env.example to $env_file on this server. CI does not upload it." >&2
    exit 1
fi

if ! docker network inspect ema_net >/dev/null 2>&1; then
    echo "Docker network ema_net is missing. Deploy EMA API on this host first." >&2
    exit 1
fi

previous_image="$(docker inspect --format '{{.Config.Image}}' "$container" 2>/dev/null || true)"

export PORTAL_IMAGE="$image"
export PORTAL_ENV_FILE="$env_file"

docker compose --env-file "$env_file" -f "$compose_file" config --quiet
docker compose --env-file "$env_file" -f "$compose_file" pull "$service"
docker compose --env-file "$env_file" -f "$compose_file" up -d --no-deps --no-build "$service"

attempt=1
while [ "$attempt" -le 30 ]; do
    health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container" 2>/dev/null || true)"

    if [ "$health" = "healthy" ]; then
        echo "$container is healthy on image $image"
        exit 0
    fi
    if [ "$health" = "unhealthy" ] || [ "$health" = "exited" ] || [ "$health" = "dead" ]; then
        break
    fi
    attempt=$((attempt + 1))
    sleep 2
done

echo "Deployment failed: $container is not healthy" >&2
docker logs --tail 120 "$container" >&2 || true

if [ -n "$previous_image" ] && [ "$previous_image" != "$image" ]; then
    echo "Rolling back to $previous_image" >&2
    export PORTAL_IMAGE="$previous_image"
    docker compose --env-file "$env_file" -f "$compose_file" up -d --no-deps --no-build "$service"
fi

exit 1
