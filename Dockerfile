# Use Microsoft's official Playwright image as base
FROM mcr.microsoft.com/playwright:v1.40.0-focal

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including session-file-store used by server.js)
RUN npm ci && npm install session-file-store

# Copy the rest of the application
COPY . .

# Expose the API port
EXPOSE 11345

# Set environment to production
ENV NODE_ENV=production

# Command to run the server
CMD ["node", "server.js"]
