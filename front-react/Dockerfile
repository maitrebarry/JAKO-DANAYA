# Frontend Dockerfile: build with Node then serve with nginx
FROM node:20 AS build
WORKDIR /app
COPY front-react/package*.json front-react/
RUN cd front-react && npm ci --no-audit --no-fund
COPY front-react/ front-react/
RUN cd front-react && npm run build

FROM nginx:stable-alpine
COPY --from=build /app/front-react/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]