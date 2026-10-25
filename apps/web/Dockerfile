
FROM nginx:alpine

COPY deploy/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY apps/web/dist/ /usr/share/nginx/html/

EXPOSE 80
