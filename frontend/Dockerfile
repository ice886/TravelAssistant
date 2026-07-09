# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
COPY .npmrc ./
COPY tsconfig.base.json ./
COPY frontend/package.json frontend/package.json

RUN --mount=type=cache,target=/root/.npm npm ci --workspace frontend

COPY frontend frontend
RUN npm run build -w frontend

FROM nginx:1.27-alpine AS runtime

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html

EXPOSE 80
