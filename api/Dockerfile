FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY api/package.json api/
COPY web/package.json web/
RUN npm ci -w api
COPY api api
RUN npm run build -w api

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY api/package.json api/
COPY web/package.json web/
RUN npm ci -w api --omit=dev
COPY --from=build /app/api/dist api/dist
COPY api/migrations api/migrations
USER node
EXPOSE 3001
# Apply migrations, then start. dist layout: dist/server.js
CMD ["sh", "-c", "node api/dist/db/migrate-cli.js && node api/dist/server.js"]
