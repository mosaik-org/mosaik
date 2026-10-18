# One image for every service; each compose service picks its entrypoint.
FROM oven/bun:1.4 AS build
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile
RUN bun run build

FROM oven/bun:1.4-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=bun:bun /app /app
USER bun
EXPOSE 3000
CMD ["bun", "services/gateway/src/main.ts"]
