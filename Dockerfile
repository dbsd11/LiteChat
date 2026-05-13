FROM docker.xuanyuan.me/library/nginx:alpine

# Copy nginx config template
COPY docker/nginx.conf.template /etc/nginx/conf.d/default.conf.template

# Copy static site files
COPY dist /usr/share/nginx/html

# Default API target
ENV VITE_API_TARGET=http://localhost:8080

# Custom entrypoint that renders config then starts nginx
COPY docker/start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 80

ENTRYPOINT ["/start.sh"]
CMD ["nginx", "-g", "daemon off;"]
