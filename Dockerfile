# Optimized multi-stage build for Huly MCP Server
FROM node:18-alpine

WORKDIR /app

# Create non-root user FIRST (rarely changes, good for caching)
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package files with correct ownership (changes infrequently)
COPY --chown=nodejs:nodejs package.json package-lock.json ./

# Switch to non-root user and install dependencies
# This layer will be cached unless package files change
USER nodejs
RUN npm ci --only=production

# Copy source code LAST (changes frequently, won't bust dependency cache)
COPY --chown=nodejs:nodejs index.js ./
COPY --chown=nodejs:nodejs StatusManager.js ./
COPY --chown=nodejs:nodejs src ./src

# Expose port
EXPOSE 3457

# Set environment variables
ENV NODE_ENV=production \
    PORT=3457 \
    HULY_URL=http://huly-front:8080 \
    HULY_EMAIL=emanuvaderland@gmail.com \
    HULY_PASSWORD=k2a8yy7sFWVZ6eL \
    HULY_WORKSPACE=agentspace

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "const http = require('http'); const options = { hostname: 'localhost', port: process.env.PORT || 3457, path: '/health', method: 'GET' }; const req = http.request(options, (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }); req.on('error', () => { process.exit(1); }); req.end();"

# Default command (HTTP transport)
CMD ["node", "index.js", "--transport=http"]
