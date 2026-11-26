# --- build ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build
# PDF libraries for the Mystery Pack console (served only inside the panel)
RUN mkdir -p server/mp/vendor && cp node_modules/pdf-lib/dist/pdf-lib.min.js node_modules/@pdf-lib/fontkit/dist/fontkit.umd.min.js server/mp/vendor/

# --- run: static site + anonymous counters + /admin (Node, no dependencies) ---
FROM node:22-alpine
RUN apk add --no-cache su-exec
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY docker-start.sh /usr/local/bin/chacalde-start
RUN chmod +x /usr/local/bin/chacalde-start && mkdir -p /data && chown node:node /data
ENV NODE_ENV=production PORT=80 DATA_DIR=/data
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s CMD wget -qO- http://127.0.0.1/healthz || exit 1
ENTRYPOINT ["chacalde-start"]
