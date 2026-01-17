FROM node:22-bullseye AS build

WORKDIR /app

# Install deps (include dev deps for build)
COPY package*.json ./
RUN npm ci --include=dev

# Build frontend
COPY . .
RUN npm run build

FROM mcr.microsoft.com/playwright:v1.40.0-focal AS runtime

WORKDIR /app

# Install production deps only
COPY package*.json ./
RUN npm ci --omit=dev

# Ensure Playwright browsers + OS deps are available
RUN npx playwright install --with-deps chromium chrome firefox

# Copy server and built assets
COPY --from=build /app/dist /app/dist
COPY --from=build /app/public /app/public
COPY --from=build /app/*.js /app/

EXPOSE 11345 54311
ENV NODE_ENV=production

CMD ["node", "server.js"]
