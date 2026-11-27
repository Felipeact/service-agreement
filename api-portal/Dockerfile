# syntax=docker/dockerfile:1
# The API & MCP portal image. It imports the web app's pure domain code (../web/domain), so build from the REPOSITORY ROOT:
#   docker build -f api-portal/Dockerfile -t service-pacts-api-portal \
#     --build-arg NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co \
#     --build-arg NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key> \
#     --build-arg NEXT_PUBLIC_APP_URL=https://app.servicepacts.com .
# Only the three NEXT_PUBLIC_ values are baked in (public by design). AUTH_COOKIE_DOMAIN is read at run time. There is no secret.

FROM node:24-alpine AS deps
WORKDIR /repo/api-portal
COPY api-portal/package.json api-portal/package-lock.json ./
RUN npm ci

FROM node:24-alpine AS build
WORKDIR /repo
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /repo/api-portal/node_modules ./api-portal/node_modules
COPY web/domain ./web/domain
COPY api-portal ./api-portal
WORKDIR /repo/api-portal
RUN npm run build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3001 \
    HOSTNAME=0.0.0.0
RUN addgroup -g 10001 -S app && adduser -S -u 10001 -G app app
# The standalone output keeps the repo-relative layout because the tracing root is the repository root.
COPY --from=build --chown=app:app /repo/api-portal/.next/standalone ./
COPY --from=build --chown=app:app /repo/api-portal/.next/static ./api-portal/.next/static
COPY --from=build --chown=app:app /repo/api-portal/public ./api-portal/public
USER 10001
EXPOSE 3001
CMD ["node", "api-portal/server.js"]
