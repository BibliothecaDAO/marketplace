#!/bin/sh
set -eu

: "${TORII_CHAIN:?TORII_CHAIN must be SN_MAIN or SN_SEPOLIA}"
: "${TORII_RPC_URL:?TORII_RPC_URL is required}"
: "${TORII_DB_DIR:=/data}"

case "$TORII_CHAIN" in
  SN_MAIN|SN_SEPOLIA) ;;
  *)
    echo "Unsupported TORII_CHAIN" >&2
    exit 64
    ;;
esac

template="/etc/torii/config/${TORII_CHAIN}.toml"
runtime_config="/run/torii/torii.toml"
test -r "$template"

umask 077
envsubst '$TORII_RPC_URL $TORII_DB_DIR' < "$template" > "$runtime_config"

exec /usr/local/bin/torii --config "$runtime_config"
