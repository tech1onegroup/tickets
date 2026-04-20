FROM node:20-alpine

WORKDIR /app

# Install dependencies (including dev for tsx/prisma)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma client and build Next.js
# JWT_SECRET + DATABASE_URL needed at build time because next build runs in
# production mode and auth.ts / prisma client init during page data collection.
ARG JWT_SECRET="build-time-placeholder-do-not-use"
ARG NEXT_PUBLIC_PHASE="TICKETS_ONLY"
ARG NEXT_PUBLIC_APP_URL="https://tickets.dev.onegroup.co.in"
ARG DATABASE_URL="postgresql://build:build@localhost:5432/build"
ARG DIRECT_URL="postgresql://build:build@localhost:5432/build"
ENV JWT_SECRET=$JWT_SECRET
ENV NEXT_PUBLIC_PHASE=$NEXT_PUBLIC_PHASE
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV DATABASE_URL=$DATABASE_URL
ENV DIRECT_URL=$DIRECT_URL
RUN npx prisma generate
RUN npm run build
ENV JWT_SECRET=""

# Create directories for persistent data
RUN mkdir -p /app/data /app/public/uploads

# Entrypoint handles migrations, seeding, and start
COPY docker-entrypoint.sh .
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000

CMD ["./docker-entrypoint.sh"]
