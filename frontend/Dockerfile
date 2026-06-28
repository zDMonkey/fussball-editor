FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install --legacy-peer-deps
COPY . .
# Leer = relative URLs (/api/...) → nginx proxiert intern zum Backend
ARG VITE_API_BASE_URL=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ARG VITE_SEARCH_ASSET_BASE_URL
ENV VITE_SEARCH_ASSET_BASE_URL=$VITE_SEARCH_ASSET_BASE_URL
ARG VITE_S3_PUBLIC_BASE_URL
ENV VITE_S3_PUBLIC_BASE_URL=$VITE_S3_PUBLIC_BASE_URL
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
