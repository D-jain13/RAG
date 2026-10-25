#!/usr/bin/env bash
#
# One-shot launcher for the whole RAG stack. Run from anywhere:  ./run.sh
#
#   1. Preflight checks (docker, uv, npm, backend/.env)
#   2. Make sure backend/Dockerfile.db exists (creates it if missing)
#   3. Build the Postgres image + start the DB container (waits until healthy)
#   4. Apply alembic migrations
#   5. Create the Procrastinate tables (skipped if they already exist)
#   6. Start the Procrastinate worker
#   7. Start the backend API   (http://localhost:8080)
#   8. Start the frontend      (http://localhost:3000)
#
# Ctrl+C stops the worker, backend and frontend. The DB container keeps running;
# use  ./run.sh stop  to stop it too.

set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT/backend"
FRONTEND_DIR="$ROOT/frontend"
LOG_DIR="$ROOT/logs"
COMPOSE_FILE="$BACKEND_DIR/docker-compose.yaml"

BACKEND_PORT=8080   # must match the proxy target in frontend/vite.config.ts
FRONTEND_PORT=3000
PROCRASTINATE_APP="backend.worker.queue.app"

# --project-directory keeps the compose project named "backend", so we reuse the
# existing container (backend-db-1) and its postgres_data volume.
compose() { docker compose -f "$COMPOSE_FILE" --project-directory "$BACKEND_DIR" "$@"; }

PIDS=()

step() { printf '\n\033[1;34m[%s/8]\033[0m \033[1m%s\033[0m\n' "$1" "$2"; }
ok()   { printf '   \033[32m✓\033[0m %s\n' "$1"; }
info() { printf '   \033[2m%s\033[0m\n' "$1"; }
die()  { printf '\n\033[1;31m✗ %s\033[0m\n' "$1" >&2; exit 1; }

cleanup() {
  trap - EXIT INT TERM
  if ((${#PIDS[@]})); then
    printf '\n\033[1mShutting down worker, backend and frontend...\033[0m\n'
    for pid in "${PIDS[@]}"; do
      # kill the whole process group so npm/uv children die too
      kill -- "-$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true
    done
    wait 2>/dev/null || true
    info "DB container left running (./run.sh stop to stop it)."
  fi
}

on_error() { die "Failed at line $1. Check the output above (service logs are in $LOG_DIR)."; }
trap 'on_error $LINENO' ERR

# Start a command in its own process group, logging to $LOG_DIR/<name>.log
start_bg() {
  local name="$1" dir="$2"; shift 2
  : > "$LOG_DIR/$name.log"
  (cd "$dir" && exec perl -e 'setpgrp(0,0); exec @ARGV' -- "$@") >>"$LOG_DIR/$name.log" 2>&1 &
  PIDS+=("$!")
  info "$name started (pid $!) → logs/$name.log"
}

wait_for_url() {
  local url="$1" name="$2" tries="${3:-60}"
  for ((i = 0; i < tries; i++)); do
    if curl -fsS -o /dev/null "$url" 2>/dev/null; then ok "$name is up at $url"; return 0; fi
    sleep 1
  done
  die "$name did not come up at $url — see $LOG_DIR/*.log"
}

port_in_use() { lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }

# ---------------------------------------------------------------- stop command
if [[ "${1:-}" == "stop" ]]; then
  compose stop db
  ok "DB container stopped."
  exit 0
fi

# ------------------------------------------------------------------- 1. checks
step 1 "Preflight checks"
command -v docker >/dev/null || die "docker not found"
docker info >/dev/null 2>&1 || die "Docker daemon is not running — start Docker Desktop and retry"
command -v uv  >/dev/null || die "uv not found (https://docs.astral.sh/uv/)"
command -v npm >/dev/null || die "npm not found — install Node.js"
command -v curl >/dev/null || die "curl not found"
command -v perl >/dev/null || die "perl not found"
[[ -f "$BACKEND_DIR/.env" ]] || die "backend/.env is missing (needs POSTGRES_*, DATABASE_URL, OPENROUTER_API_KEY)"
port_in_use "$BACKEND_PORT"  && die "Port $BACKEND_PORT is already in use (is the backend already running?)"
port_in_use "$FRONTEND_PORT" && die "Port $FRONTEND_PORT is already in use (is the frontend already running?)"
mkdir -p "$LOG_DIR"
ok "docker, uv, npm, backend/.env present; ports $BACKEND_PORT and $FRONTEND_PORT are free"

# --------------------------------------------------------------- 2. Dockerfile
step 2 "Dockerfile for the database image"
if [[ -f "$BACKEND_DIR/Dockerfile.db" ]]; then
  ok "backend/Dockerfile.db already exists"
else
  cat > "$BACKEND_DIR/Dockerfile.db" <<'EOF'
FROM pgvector/pgvector:pg18-trixie

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      build-essential git ca-certificates postgresql-server-dev-18 \
 && git clone --branch v1.1.0 --depth 1 \
      https://github.com/timescale/pg_textsearch /tmp/pg_textsearch \
 && make -C /tmp/pg_textsearch \
 && make -C /tmp/pg_textsearch install \
 && rm -rf /tmp/pg_textsearch \
 && apt-get purge -y build-essential git postgresql-server-dev-18 \
 && apt-get autoremove -y \
 && rm -rf /var/lib/apt/lists/*
EOF
  ok "created backend/Dockerfile.db"
fi

# ------------------------------------------------------------ 3. DB container
step 3 "Build image and start the database container"
compose up -d --build --wait db
ok "Postgres container is healthy (localhost:5433)"

# ---------------------------------------------------------------- 4. migrations
step 4 "Apply alembic migrations"
(cd "$BACKEND_DIR" && uv run alembic upgrade head)
ok "database schema is at head"

# ------------------------------------------------------- 5. procrastinate tables
step 5 "Create Procrastinate tables"
# shellcheck disable=SC1091
set -a; source "$BACKEND_DIR/.env"; set +a
has_table="$(compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc \
  "SELECT to_regclass('public.procrastinate_jobs') IS NOT NULL" | tr -d '[:space:]')"
if [[ "$has_table" == "t" ]]; then
  ok "procrastinate tables already exist — skipping"
else
  (cd "$BACKEND_DIR" && uv run procrastinate --app="$PROCRASTINATE_APP" schema --apply)
  ok "procrastinate schema applied"
fi

# ----------------------------------------------------------------- 6. worker
trap cleanup EXIT INT TERM
step 6 "Start the Procrastinate worker"
start_bg worker "$BACKEND_DIR" uv run procrastinate --app="$PROCRASTINATE_APP" worker
sleep 3
kill -0 "${PIDS[0]}" 2>/dev/null || die "Worker exited immediately — see logs/worker.log"
ok "worker running"

# ---------------------------------------------------------------- 7. backend
step 7 "Start the backend API"
start_bg backend "$BACKEND_DIR" uv run uvicorn backend.main:app --host 127.0.0.1 --port "$BACKEND_PORT"
wait_for_url "http://127.0.0.1:$BACKEND_PORT/ready" "backend"

# --------------------------------------------------------------- 8. frontend
step 8 "Start the frontend"
if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
  info "node_modules missing — running npm install"
  (cd "$FRONTEND_DIR" && npm install)
fi
start_bg frontend "$FRONTEND_DIR" npm run dev
wait_for_url "http://127.0.0.1:$FRONTEND_PORT" "frontend"

printf '\n\033[1;32mAll services are running.\033[0m\n'
printf '   App       http://localhost:%s\n' "$FRONTEND_PORT"
printf '   API docs  http://localhost:%s/docs\n' "$BACKEND_PORT"
printf '   Logs      %s/{worker,backend,frontend}.log\n' "$LOG_DIR"
printf '   Press Ctrl+C to stop worker, backend and frontend.\n\n'

# Stay in the foreground; exit if any service dies.
while true; do
  for pid in "${PIDS[@]}"; do
    kill -0 "$pid" 2>/dev/null || die "A service exited unexpectedly (pid $pid) — see $LOG_DIR/*.log"
  done
  sleep 3
done
