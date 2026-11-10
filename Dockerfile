# HuiSafe web (Next.js) and keeper in one image. Build, then pick the process with the command:
#
#   docker build -t huisafe --build-arg NEXT_PUBLIC_PRIVY_APP_ID=<public app id> .
#   docker run --rm -p 3000:3000 <server-only variables, see docs/HOSTING.md> huisafe        # web (default)
#   docker run --rm <KEEPER_PRIVATE_KEY, FUJI_RPC_URL> huisafe pnpm --filter keeper start     # keeper
#
# Secrets are NEVER baked in: pass them at run time (-e NAME, or a variables file kept outside the repo). Only the
# NEXT_PUBLIC_* values are compile-time (they are public and Next inlines them into the browser bundle). The image
# carries contracts/deployments/fuji.json, which the server code reads at run time. Run ONE web container (the relay
# keeps its rate limits and nonce in memory, docs/05 section 8.2) and ONE keeper container.
FROM node:22-slim
ENV NEXT_TELEMETRY_DISABLED=1
# pnpm is fetched at build time into a directory the runtime user can read: without this, `pnpm ... start` downloads
# pnpm again on every container start and fails offline. Keep the version in step with "packageManager" in package.json.
ENV COREPACK_HOME=/opt/corepack
RUN corepack enable && corepack prepare pnpm@12.14.0 --activate && chmod -R a+rX /opt/corepack
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
ARG NEXT_PUBLIC_PRIVY_APP_ID=
ARG NEXT_PUBLIC_HUISAFE_DEMO=true
ENV NEXT_PUBLIC_PRIVY_APP_ID=$NEXT_PUBLIC_PRIVY_APP_ID NEXT_PUBLIC_HUISAFE_DEMO=$NEXT_PUBLIC_HUISAFE_DEMO
RUN pnpm --filter web build
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
RUN chown -R node:node /app
USER node
CMD ["pnpm", "--filter", "web", "start", "-H", "0.0.0.0", "-p", "3000"]
