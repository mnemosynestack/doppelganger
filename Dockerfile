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

# Install VNC + Xvfb for headful sessions in Docker
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        xvfb \
        x11vnc \
        novnc \
        websockify \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Install production deps only
COPY package*.json ./
RUN npm ci --omit=dev

# Ensure Playwright browsers + OS deps are available
RUN npx playwright install --with-deps chromium chrome firefox

# Copy server and built assets
COPY --from=build /app/dist /app/dist
COPY --from=build /app/public /app/public
COPY --from=build /app/*.js /app/
COPY --from=build /app/start-vnc.sh /app/start-vnc.sh

EXPOSE 11345
EXPOSE 54311
ENV NODE_ENV=production

CMD ["bash", "/app/start-vnc.sh"]
