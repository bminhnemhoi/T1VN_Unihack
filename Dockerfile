# HuiSafe web (Next.js standalone server). The keeper has its own image: Dockerfile.keeper.
#
#   docker build -t huisafe-web --build-arg NEXT_PUBLIC_PRIVY_APP_ID=<public app id> \
#                --build-arg NEXT_PUBLIC_FUJI_RPC_URL=<public RPC, NEVER one with an API key> .
#   docker run --rm -p 3000:3000 <server-only variables, see docs/HOSTING.md> huisafe-web
#
# Secrets are NEVER baked in: pass them at run time (-e NAME, or a variables file kept outside the repo). Only the
# NEXT_PUBLIC_* values are compile-time (they are public and Next inlines them into the browser bundle). The image
# carries contracts/deployments/fuji.json, which the server code reads at run time. Run ONE web container (the relay
# keeps its rate limits and nonce in memory, docs/05 section 8.2).
FROM node:22-slim AS build
ENV NEXT_TELEMETRY_DISABLED=1
# pnpm is fetched at build time: keep the version in step with "packageManager" in package.json.
RUN corepack enable && corepack prepare pnpm@12.14.0 --activate
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
ARG NEXT_PUBLIC_PRIVY_APP_ID=
ARG NEXT_PUBLIC_HUISAFE_DEMO=true
ARG NEXT_PUBLIC_FUJI_RPC_URL=
ENV NEXT_PUBLIC_PRIVY_APP_ID=$NEXT_PUBLIC_PRIVY_APP_ID NEXT_PUBLIC_HUISAFE_DEMO=$NEXT_PUBLIC_HUISAFE_DEMO \
    NEXT_PUBLIC_FUJI_RPC_URL=$NEXT_PUBLIC_FUJI_RPC_URL NEXT_OUTPUT=standalone
RUN pnpm --filter web build

# Runtime image: only the traced server, the static assets and the deployment addresses.
FROM node:22-slim AS web
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
COPY --from=build --chown=node:node /app/contracts/deployments ./contracts/deployments
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
