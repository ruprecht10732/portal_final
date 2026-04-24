---
name: docker-compose-stack
description: Manage fullstack Docker Compose for Angular + Go + PostgreSQL
compatibility: opencode
metadata:
  audience: devops-developers
  stack: docker
---

## What I do

Help set up and manage Docker Compose configurations for the full Angular 21 + Go + PostgreSQL development stack.

## When to use me

Use this skill when setting up local development environments, adding services to Docker Compose, or configuring the fullstack container orchestration.

## docker-compose.yml Template

```yaml
version: "3.9"

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${DB_USER:-app}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-secret}
      POSTGRES_DB: ${DB_NAME:-myapp}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./migrations:/docker-entrypoint-initdb.d
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-app} -d ${DB_NAME:-myapp}"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
      target: dev
    environment:
      DB_HOST: postgres
      DB_PORT: 5432
      DB_USER: ${DB_USER:-app}
      DB_PASSWORD: ${DB_PASSWORD:-secret}
      DB_NAME: ${DB_NAME:-myapp}
      PORT: 8080
    ports:
      - "8080:8080"
    volumes:
      - ./backend:/app
    depends_on:
      postgres:
        condition: service_healthy
    command: ["air", "-c", ".air.toml"]

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      target: dev
    environment:
      API_URL: http://localhost:8080
    ports:
      - "4200:4200"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    depends_on:
      - backend
    command: ["npm", "run", "start", "--", "--host", "0.0.0.0"]

volumes:
  postgres_data:
```

## .env Template

```env
# Database
DB_USER=app
DB_PASSWORD=secret
DB_NAME=myapp
DB_HOST=localhost
DB_PORT=5432

# Backend
API_PORT=8080
JWT_SECRET=change-me-in-production
LOG_LEVEL=debug

# Frontend
NG_PORT=4200
API_URL=http://localhost:8080
```

## Dockerfile - Go Backend (Multi-stage)

```dockerfile
# Build stage
FROM golang:1.23-alpine AS builder
WORKDIR /app
RUN apk add --no-cache git
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o server ./cmd/server

# Dev stage (with hot reload)
FROM golang:1.23-alpine AS dev
WORKDIR /app
RUN go install github.com/air-verse/air@latest
COPY go.mod go.sum ./
RUN go mod download
CMD ["air", "-c", ".air.toml"]

# Production stage
FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /app/server .
EXPOSE 8080
CMD ["./server"]
```

## Key Patterns

- **Health checks**: Always define health checks for dependencies
- **Depends_on with conditions**: Use `condition: service_healthy` not just `depends_on`
- **Named volumes**: Use named volumes for persistent data
- **Environment files**: Use `.env` files for local config, never commit secrets
- **Multi-stage builds**: Separate dev (hot reload) and production builds
- **Port consistency**: Document all exposed ports clearly

## Useful Commands

```bash
# Start everything
docker-compose up -d

# View logs
docker-compose logs -f backend

# Run migrations
docker-compose exec backend go run ./cmd/migrate up

# Database shell
docker-compose exec postgres psql -U app -d myapp

# Rebuild after dependency changes
docker-compose up -d --build backend
```
