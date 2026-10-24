# ---- build the web UI ----
FROM node:22-alpine AS ui
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- build the Go binary (UI embedded) ----
FROM golang:1.26-alpine AS go
WORKDIR /app/backend
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
COPY --from=ui /app/backend/web/dist ./web/dist
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /localmind ./cmd/server

# ---- runtime ----
FROM alpine:3.20
RUN apk add --no-cache ca-certificates && adduser -D -h /data localmind
USER localmind
WORKDIR /data
ENV SERVER_ADDRESS=:8080 DATA_DIR=/data
# Tip: a provider on the host is reachable at http://host.docker.internal:11434 (set it in the first-run screen
# or via DEFAULT_PROVIDER / DEFAULT_PROVIDER_URL environment variables).
VOLUME ["/data"]
EXPOSE 8080
COPY --from=go /localmind /usr/local/bin/localmind
ENTRYPOINT ["localmind"]
