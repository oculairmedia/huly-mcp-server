# Use the existing working MCP image as base
FROM huly-huly-mcp:latest AS working-deps

# Final image
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package.json ./

# Copy working node_modules from the existing image
COPY --from=working-deps /app/node_modules ./node_modules

# Update just the MCP SDK package
RUN npm install @modelcontextprotocol/sdk@latest --no-save

# Copy source code
COPY index.js ./
COPY StatusManager.js ./
COPY src ./src

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership of app directory
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 3000

# Set default environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HULY_URL=http://huly-front:8080
ENV HULY_EMAIL=emanuvaderland@gmail.com
ENV HULY_PASSWORD=k2a8yy7sFWVZ6eL
ENV HULY_WORKSPACE=agentspace

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "const http = require('http'); const options = { hostname: 'localhost', port: process.env.PORT || 3000, path: '/health', method: 'GET' }; const req = http.request(options, (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }); req.on('error', () => { process.exit(1); }); req.end();"

# Default command (HTTP transport)
CMD ["node", "index.js", "--transport=http"]