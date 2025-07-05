# Build stage
FROM golang:1.24.3-alpine AS builder

# Add ca-certificates for HTTPS requests
RUN apk add --no-cache ca-certificates git

WORKDIR /usr/src/app

# Copy go mod files first for better layer caching
COPY go.mod go.sum ./
RUN go mod download && go mod verify

# Copy source code
COPY . .

# Build optimized static binary
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags='-w -s -extldflags "-static"' \
    -a -installsuffix cgo \
    -o /run-app .

# Final stage - use distroless for minimal attack surface
FROM gcr.io/distroless/static-debian12:nonroot

# Copy CA certificates from builder
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

# Copy the binary
COPY --from=builder /run-app /usr/local/bin/run-app

# Expose port
EXPOSE 8080

# Run as non-root user (distroless nonroot user)
USER nonroot:nonroot

# Start the application
CMD ["/usr/local/bin/run-app"]
