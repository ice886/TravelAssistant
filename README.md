# TravelAssistant

TravelAssistant is a local full-stack travel planning workbench. The first version uses a React frontend, a Nest.js backend, Postgres, and a local Xiaohongshu MCP service.

## Architecture

- `frontend/`: React + TypeScript workbench. It only calls this project's backend API.
- `backend/`: Nest.js + Fastify + TypeScript API. It owns Agent orchestration, external API access, persistence, and safety boundaries.
- `postgres`: Local database for trips, sources, itinerary versions, and Agent runs.
- `xiaohongshu-mcp`: Local MCP service mounted under `docker/xhs/`.

## Local Setup

```bash
cp .env.example .env
npm install
npm run dev:backend
npm run dev:frontend
```

The frontend runs on `http://localhost:5173`, and the backend health endpoint is `http://localhost:3000/api/health`.

## Docker Compose

```bash
cp .env.example .env
docker compose up --build
```

Compose starts:

- `web` on `${WEB_PORT:-5173}`
- `api` on `${API_PORT:-3000}`
- `postgres` on `5432`

The Xiaohongshu MCP image is optional because it currently requires the `linux/amd64` platform on Apple Silicon:

```bash
docker compose --profile xhs up --build
```

That starts `xiaohongshu-mcp` on `18060`.

## Quality Checks

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Safety Notes

- Do not commit `.env` or API keys.
- The browser frontend must not call Xiaohongshu MCP, Amap, Tavily, or LLM APIs directly.
- Xiaohongshu MCP usage is read-only in the first version.
