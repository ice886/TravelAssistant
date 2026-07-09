# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
COPY .npmrc ./
COPY tsconfig.base.json ./
COPY backend/package.json backend/package.json

RUN --mount=type=cache,target=/root/.npm npm ci --workspace backend

COPY backend backend
RUN npm run build -w backend

FROM node:20-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json* ./
COPY .npmrc ./
COPY backend/package.json backend/package.json
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --workspace backend

COPY --from=build /app/backend/dist backend/dist

WORKDIR /app/backend
EXPOSE 3000

CMD ["node", "dist/main.js"]
