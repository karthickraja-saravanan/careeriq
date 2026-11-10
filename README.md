# CareerIQ

> DRAFT NOTES: Karthick rewrites the sections below in their own words. See docs/README-notes.md for prompts per required section.

## Quick start
```bash
cp .env.example .env
docker compose up --build   # web: http://localhost:8080, api: http://localhost:3001/api/v1/health
```
Local dev: `npm install`, start Postgres (`docker compose up db`), then `npm run migrate` and `npm run dev:api` / `npm run dev:web`.

Tests: `TEST_DATABASE_URL=postgres://careeriq:careeriq@localhost:5432/careeriq npm test`
