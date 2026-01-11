FROM node:18-alpine AS compression-builder
WORKDIR /tmp
RUN npm pack compression@1.8.1 && \
    mkdir -p node_modules && \
    tar -xzf compression-1.8.1.tgz -C node_modules && \
    mv node_modules/package node_modules/compression && \
    cd node_modules/compression && npm install --omit=dev --ignore-scripts

FROM huly-huly-mcp:v0.7

USER root

COPY --from=compression-builder /tmp/node_modules/compression /app/node_modules/compression
COPY --from=compression-builder /tmp/node_modules/compression/node_modules /tmp/compression-deps
RUN cp -rn /tmp/compression-deps/* /app/node_modules/ 2>/dev/null || true && rm -rf /tmp/compression-deps

COPY --chown=nodejs:nodejs index.js /app/
COPY --chown=nodejs:nodejs StatusManager.js /app/
COPY --chown=nodejs:nodejs src /app/src
COPY --chown=nodejs:nodejs package.json /app/

USER nodejs

ENV NODE_ENV=production
ENV PORT=3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "const http = require('http'); const options = { hostname: 'localhost', port: process.env.PORT || 3000, path: '/health', method: 'GET' }; const req = http.request(options, (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }); req.on('error', () => { process.exit(1); }); req.end();"

CMD ["node", "index.js", "--transport=http"]
