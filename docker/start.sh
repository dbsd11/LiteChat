#!/bin/sh
set -e

# Ensure VITE_API_TARGET is set
export VITE_API_TARGET="${VITE_API_TARGET:-http://localhost:8080}"

echo ">>> Rendering nginx config with VITE_API_TARGET=${VITE_API_TARGET}"
envsubst '${VITE_API_TARGET}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf

# Execute the CMD (nginx by default)
exec "$@"
