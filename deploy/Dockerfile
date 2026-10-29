ARG NODE_IMAGE=node:22-alpine

FROM ${NODE_IMAGE} AS build

RUN corepack enable
RUN rm -rf /app && mkdir -p /app
WORKDIR /app

ARG VITE_AGENT_BASE_URL=/api/agent/v1
ARG VITE_AGENT_MODEL=
ENV VITE_AGENT_BASE_URL=$VITE_AGENT_BASE_URL
ENV VITE_AGENT_MODEL=$VITE_AGENT_MODEL

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml LICENSE NOTICE ./
COPY packages ./packages
COPY services ./services
COPY examples ./examples
COPY website ./website
COPY content ./content
COPY scripts ./scripts

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @plingjs/website build
RUN pnpm --filter @plingjs/example-todo-surface-auth build

FROM ${NODE_IMAGE} AS runtime

RUN corepack enable
ENV NODE_ENV=production
RUN rm -rf /app && mkdir -p /app
WORKDIR /app
COPY --from=build /app /app

FROM caddy:2-alpine AS caddy

COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/website/.vitepress/dist /srv/pling/website
COPY --from=build /app/website/.vitepress/dist/demos /srv/pling/demo/demos
