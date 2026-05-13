FROM nginx:alpine

# Copy nginx config template (with env placeholder)
COPY docker/nginx.conf.template /etc/nginx/conf.d/default.conf.template

# Copy static site files
COPY dist /usr/share/nginx/html

# Copy startup script that renders nginx config from env vars
COPY docker/entrypoint.sh /docker-entrypoint.d/10-render-nginx.sh
RUN chmod +x /docker-entrypoint.d/10-render-nginx.sh

# Default API target (can be overridden at runtime via -e VITE_API_TARGET=...)
ENV VITE_API_TARGET=http://localhost:8080

EXPOSE 80
