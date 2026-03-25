# Stage 1: Build
FROM node:20-alpine AS build
RUN corepack enable pnpm

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/core/package.json packages/core/
COPY packages/web/package.json packages/web/
COPY packages/server/package.json packages/server/
COPY packages/userscript/package.json packages/userscript/
COPY packages/extension/package.json packages/extension/
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

# Stage 2: Production runtime
FROM node:20-alpine
RUN corepack enable pnpm

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/core/package.json packages/core/
COPY packages/server/package.json packages/server/
RUN pnpm install --frozen-lockfile --prod

# Copy built artifacts
COPY --from=build /app/packages/server/dist packages/server/dist
COPY --from=build /app/packages/server/build-info.json packages/server/
COPY --from=build /app/dist/web dist/web
COPY --from=build /app/packages/userscript/dist packages/userscript/dist
COPY --from=build /app/packages/core/dist packages/core/dist

CMD ["node", "packages/server/dist/index.js"]
