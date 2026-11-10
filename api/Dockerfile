FROM node:22-slim AS build
WORKDIR /app
# onnxruntime-node (embedding model runtime) ships a 260 MB CUDA library we do not use.
ENV ONNXRUNTIME_NODE_INSTALL_CUDA=skip
COPY package.json package-lock.json ./
COPY api/package.json api/
COPY web/package.json web/
RUN npm ci -w api
COPY api api
RUN npm run build -w api

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
ENV ONNXRUNTIME_NODE_INSTALL_CUDA=skip
COPY package.json package-lock.json ./
COPY api/package.json api/
COPY web/package.json web/
RUN npm ci -w api --omit=dev
COPY --from=build /app/api/dist api/dist
COPY api/migrations api/migrations
COPY api/seed-data api/seed-data
# Named volume inherits this ownership, so the non-root user can write uploads.
RUN mkdir -p /app/storage /app/.models && chown node:node /app/storage /app/.models
USER node
EXPOSE 3001
# Apply migrations, then start. dist layout: dist/server.js
CMD ["sh", "-c", "node api/dist/db/migrate-cli.js && node api/dist/server.js"]
