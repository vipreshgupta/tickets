FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy source
COPY . .

# Build
RUN npm run build

# Production
FROM node:20-alpine AS production
WORKDIR /app

COPY --from=base /app/.next ./.next
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package.json ./
COPY --from=base /app/public ./public

EXPOSE 3000
CMD ["npm", "start"]
