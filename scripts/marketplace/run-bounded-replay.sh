#!/bin/sh
set -eu

root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)

: "${TORII_IMAGE:?TORII_IMAGE must be an immutable image reference}"
: "${UPSTREAM_RPC_URL:?UPSTREAM_RPC_URL is required}"
: "${REPLAY_CHAIN:?REPLAY_CHAIN must be SN_MAIN or SN_SEPOLIA}"
: "${REPLAY_RUN_ID:?REPLAY_RUN_ID must uniquely identify this empty replay}"

case "$TORII_IMAGE" in
  *@sha256:????????????????????????????????????????????????????????????????) ;;
  *) echo "TORII_IMAGE must be pinned by sha256 digest" >&2; exit 64 ;;
esac
case "$REPLAY_CHAIN" in
  SN_MAIN|SN_SEPOLIA) ;;
  *) echo "REPLAY_CHAIN must be SN_MAIN or SN_SEPOLIA" >&2; exit 64 ;;
esac

output_root=${REPLAY_OUTPUT_DIR:-"$root/.context/replays"}
run_dir="$output_root/$REPLAY_RUN_ID"
if [ -e "$run_dir" ]; then
  echo "Replay output already exists: $run_dir" >&2
  exit 73
fi
mkdir -p "$run_dir/db"

checkpoint=$(jq -er ".chains.${REPLAY_CHAIN}.blockNumber" \
  "$root/config/marketplace/rpc-checkpoints.json")
proxy_port=${REPLAY_RPC_PROXY_PORT:-18545}
torii_port=8080
container="marketplace-replay-${REPLAY_RUN_ID}"
proxy_pid=""

cleanup() {
  if [ -n "$proxy_pid" ]; then kill "$proxy_pid" 2>/dev/null || true; fi
  docker stop --time 30 "$container" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

(
  cd "$root"
  RPC_PROXY_HOST=127.0.0.1 \
  RPC_PROXY_PORT="$proxy_port" \
  RPC_CHECKPOINT_BLOCK="$checkpoint" \
  UPSTREAM_RPC_URL="$UPSTREAM_RPC_URL" \
    corepack pnpm@10.8.1 --filter @biblio/marketplace-ops proxy:bounded
) >"$run_dir/bounded-rpc.log" 2>&1 &
proxy_pid=$!

attempt=0
until curl --fail --silent "http://127.0.0.1:${proxy_port}/health" >/dev/null; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 30 ]; then echo "Bounded RPC did not become ready" >&2; exit 1; fi
  sleep 1
done

started_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
docker run --detach --name "$container" --network host \
  --env TORII_CHAIN="$REPLAY_CHAIN" \
  --env TORII_RPC_URL="http://127.0.0.1:${proxy_port}/" \
  --env TORII_DB_DIR=/data \
  --mount "type=bind,source=$run_dir/db,target=/data" \
  "$TORII_IMAGE" >/dev/null

attempt=0
while :; do
  if ! docker inspect --format '{{.State.Running}}' "$container" 2>/dev/null | grep -q true; then
    docker logs "$container" >"$run_dir/torii.log" 2>&1 || true
    echo "Torii stopped before reaching the checkpoint" >&2
    exit 1
  fi
  response=$(curl --silent --show-error --request POST \
    --header 'content-type: application/json' \
    --data 'SELECT MAX(head) AS indexed_block FROM contracts' \
    "http://127.0.0.1:${torii_port}/sql" 2>/dev/null || true)
  indexed=$(printf '%s' "$response" | jq -er 'if type == "array" then .[0].indexed_block else .data[0].indexed_block end' 2>/dev/null || true)
  if [ "$indexed" = "$checkpoint" ]; then break; fi
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 21600 ]; then echo "Replay did not finish within six hours" >&2; exit 1; fi
  sleep 1
done

TORII_URL="http://127.0.0.1:${torii_port}" \
REPLAY_CHAIN="$REPLAY_CHAIN" \
REPLAY_REPORT_PATH="$run_dir/reconciliation.json" \
  corepack pnpm@10.8.1 --dir "$root" --filter @biblio/marketplace-ops reconcile \
  >"$run_dir/reconciliation.stdout.json"

docker stats --no-stream --format '{{json .}}' "$container" >"$run_dir/resources.json"
docker logs "$container" >"$run_dir/torii.log" 2>&1
completed_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
jq -n \
  --arg chain "$REPLAY_CHAIN" \
  --arg startedAt "$started_at" \
  --arg completedAt "$completed_at" \
  --argjson checkpointBlock "$checkpoint" \
  '{chain:$chain,checkpointBlock:$checkpointBlock,startedAt:$startedAt,completedAt:$completedAt}' \
  >"$run_dir/run.json"

echo "Replay evidence written to $run_dir"
