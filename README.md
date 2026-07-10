# TravelAssistant

TravelAssistant is a local full-stack travel planning workbench. The first version uses a React frontend, a Nest.js backend, Postgres, and a local Xiaohongshu MCP service.

## Architecture

- `frontend/`: React + TypeScript workbench. It only calls this project's backend API.
- `backend/`: Nest.js + Fastify + TypeScript API. It owns Agent orchestration, external API access, persistence, and safety boundaries.
- `postgres`: Local database for trips, sources, itinerary versions, and Agent runs.
- `xiaohongshu-mcp`: Local MCP service mounted under `docker/xhs/`.
- External providers are accessed only through backend provider services: Amap for map/place data, Tavily for web search, and an OpenAI-compatible LLM endpoint for reasoning.

## Local Setup

```bash
cp .env.example .env
npm install
npm run dev:backend
npm run dev:frontend
```

The frontend runs on `http://localhost:5173`, and the backend health endpoint is `http://localhost:3000/api/health`.

The backend expects `DATABASE_URL` to point at Postgres before trip APIs are used. With Docker Compose, the default URL is already wired to the `postgres` service.

For host-machine backend development with Postgres or Xiaohongshu MCP running in Docker, create local overrides:

```bash
cp .env.local.example .env.local
```

Then adjust the password in `.env.local` if your local Postgres password differs from the example. The backend loads `.env` first and `.env.local` second, so `.env.local` can override Docker service names with `localhost`.

## API Surface

- `GET /api/health`: returns API status and safe configuration presence flags.
- `GET /api/xhs/status`: checks Xiaohongshu MCP connectivity, login status, discovered tools, and read-only safety flags.
- `GET /api/xhs/login-qrcode`: requests the Xiaohongshu MCP login QR code through the backend safety layer.
- `GET /api/xhs/login-qrcode/image`: returns the Xiaohongshu login QR code as an `image/png` response for direct scanning.
- `POST /api/trips`: creates a local draft trip from destination, days or dates, interests, budget, and traveler fields.
- `GET /api/trips`: lists local trips, newest first.
- `GET /api/trips/:id`: returns one local trip.
- `POST /api/trips/:id/research`: creates an Agent research run, performs safe preflight checks, and collects Xiaohongshu, Amap, and Tavily sources.
- `GET /api/trips/:id/research-runs/latest`: returns the latest Agent research run, including status, stage, checks, and source count.
- `GET /api/trips/:id/research-sources`: returns sources collected by the latest research run.

Creating a trip does not require Xiaohongshu MCP. Research runs degrade safely when provider keys are missing or the MCP service is unavailable.

When a research run is waiting for Xiaohongshu login, the Agent panel can display or refresh a QR code. After scanning, use “我已扫码，重新检查” to verify the session and resume source research.

## Provider Configuration

The backend owns all third-party API keys. The frontend only receives safe configured/missing flags through `GET /api/health`.

- Amap: `AMAP_API_KEY`, optional `AMAP_BASE_URL`, `AMAP_TIMEOUT_MS`
- Tavily: `TAVILY_API_KEY`, optional `TAVILY_BASE_URL`, `TAVILY_TIMEOUT_MS`
- LLM: `LLM_PROVIDER`, `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`, optional `LLM_TIMEOUT_MS`

Provider services live under `backend/src/modules/providers/` and return stable internal DTOs. Research source records store bounded summaries and metadata rather than complete third-party payloads.

## Docker Compose

```bash
cp .env.example .env
docker compose up --build
```

The Docker builds use the root `.npmrc` retry and timeout settings, plus a BuildKit npm cache, so package installation is more resilient on slow or reset-prone networks.

Compose starts:

- `web` on `${WEB_PORT:-5173}`
- `api` on `${API_PORT:-3000}`
- `postgres` on `5432`

The Xiaohongshu MCP image is optional because it currently requires the `linux/amd64` platform on Apple Silicon:

```bash
docker compose --profile xhs up --build
```

That starts `xiaohongshu-mcp` on `18060`.

The Compose service follows the official MCP container layout: cookies are stored at `docker/xhs/data/cookies.json`, while browser home/cache/config directories are stored under `docker/xhs/data/`. These files are local runtime data and are ignored by Git.

When running the backend outside Docker and the MCP container inside Docker, set `XHS_MCP_URL` to a host-reachable URL such as `http://localhost:18060/mcp`.

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
- Xiaohongshu MCP usage is read-only in the first version. The backend allows only `XHS_READONLY_TOOLS` and explicitly blocks publishing, commenting, liking, favoriting, and cookie deletion tools.
