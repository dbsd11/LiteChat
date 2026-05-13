#!/bin/sh
# Render nginx config from environment variables at container startup
echo "Rendering nginx config with VITE_API_TARGET=${VITE_API_TARGET}"
envsubst '${VITE_API_TARGET}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf
cat /etc/nginx/conf.d/default.conf
