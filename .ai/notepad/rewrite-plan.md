
# CAF GPT Rewrite Plan: Go + HTMX + Templ in Docker

## 1. Project Overview

The current application is built with SvelteKit and TypeScript, using Cloudflare Workers for deployment. It provides two main features:
- PaceNoteFoo: Generates professional pace notes for Canadian Armed Forces members
- PolicyFoo: Answers questions about CAF policies

For the rewrite, we'll use:
- Go as the backend language
- HTMX for interactive front-end components without JavaScript frameworks
- Templ (Go template engine) for server-side rendering of HTML
- Docker for containerization
- TigrisData S3-compatible storage instead of R2

## 2. Project Structure

```
caf-gpt-go/
├── cmd/
│   └── cafgpt/
│       └── main.go          # Entry point
├── internal/
│   ├── handlers/            # HTTP handlers for routes
│   │   ├── health.go        # Health check handler
│   │   ├── pacenote.go      # PaceNoteFoo handlers
│   │   └── policy.go        # PolicyFoo handlers
│   ├── services/            # Business logic and AI interactions
│   │   ├── ai_service.go    # AI service integration
│   │   ├── pacenote_service.go
│   │   └── policy_service.go
│   ├── templates/           # HTML templates using Templ
│   │   ├── layout.html      # Main layout template
│   │   ├── index.html       # Home page
│   │   ├── pacenote.html    # PaceNoteFoo page
│   │   └── policy.html      # PolicyFoo page
│   ├── storage/             # S3/TigrisData integration
│   │   └── s3_client.go     # S3 client implementation
│   ├── config/              # Configuration management
│   │   └── config.go        # Environment variables and configuration
│   └── middleware/          # Middleware for logging, etc.
├── static/                  # Static assets (CSS, JS)
│   ├── css/
│   │   └── app.css          # Main stylesheet
│   └── js/
│       └── htmx.min.js      # HTMX library
├── Dockerfile               # Docker configuration
├── docker-compose.yml       # Docker Compose configuration (if needed)
├── go.mod                   # Go module file
├── go.sum                   # Go dependencies
└── README.md                # Project documentation
```

## 3. Backend Implementation

### 3.1 API Handlers

- Implement HTTP handlers in Go that replicate the functionality of current SvelteKit routes
- Use standard Go net/http package for routing and handling requests
- Create separate handler files for each feature (health, pacenote, policy)

### 3.2 Service Layer

- Create service layers to handle business logic and AI interactions
- Implement functions to:
  - Generate pace notes with AI
  - Answer policy questions with AI
  - Validate input data
  - Read/write from/to storage

## 4. Front-end Implementation

### 4.1 Templ for Server-Side Rendering

- Design HTML templates using Go's html/template package (Templ)
- Create a main layout template and specific page templates
- Use HTMX for interactive components without JavaScript frameworks

### 4.2 HTMX Integration

- Add HTMX attributes to HTML elements for interactivity:
  - hx-get, hx-post for AJAX requests
  - hx-trigger for event triggers
  - hx-target for specifying target elements
  - hx-swap for defining how content should be swapped
- Implement forms and buttons that use HTMX to submit data and update the page dynamically

## 5. Docker Configuration

### 5.1 Dockerfile

- Write a Dockerfile to build the Go application:
```Dockerfile
# Use official Golang image as base image
FROM golang:1.23-alpine

# Set working directory
WORKDIR /app

# Copy go.mod and go.sum files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy the source from the current directory to the Working Directory inside the container
COPY . .

# Build the Go app
RUN go build -o main ./cmd/cafgpt

# Expose port 8080 for the app
EXPOSE 8080

# Command to run the executable
CMD ["./main"]
```

### 5.2 docker-compose.yml (if needed)

- Create a docker-compose.yml file if multi-container setup is required:
```yaml
version: '3.8'

services:
  cafgpt:
    build: .
    ports:
      - "8080:8080"
    environment:
      - OPENROUTER_TOKEN=${OPENROUTER_TOKEN}
      - AI_GATEWAY_BASE_URL=${AI_GATEWAY_BASE_URL}
      - CF_AIG_TOKEN=${CF_AIG_TOKEN}
      - S3_ENDPOINT=${S3_ENDPOINT}
      - S3_ACCESS_KEY=${S3_ACCESS_KEY}
      - S3_SECRET_KEY=${S3_SECRET_KEY}
      - S3_BUCKET_NAME=${S3_BUCKET_NAME}
```

## 6. S3 Integration with TigrisData

### 6.1 Configuration

- Configure Go to use TigrisData as an S3-compatible storage solution
- Set up environment variables for S3 connection:
  - S3_ENDPOINT
  - S3_ACCESS_KEY
  - S3_SECRET_KEY
  - S3_BUCKET_NAME

### 6.2 Implementation

- Implement functions to read/write data from/to TigrisData buckets using the AWS SDK for Go (or a compatible library)
- Replace R2-specific code with S3-compatible code

## 7. Documentation

### 7.1 README.md

- Document the project structure, setup instructions, and usage
- Include information about:
  - Building and running the application
  - Environment variables required
  - How to use the features (PaceNoteFoo, PolicyFoo)
  - Docker commands for building and running containers

### 7.2 Code Comments

- Add comments to code where necessary to explain complex logic or important functionality

## 8. Next Steps

1. Set up Go project structure
2. Implement basic HTTP server with routing
3. Create service layer for business logic
4. Implement S3 integration with TigrisData
5. Design HTML templates with Templ and HTMX
6. Implement API handlers and connect to services
7. Write Dockerfile and test containerization
8. Add comprehensive documentation

## 9. Considerations

- Maintain the same functionality and app logic as the current implementation
- Ensure proper error handling and input validation
- Optimize performance for both backend and front-end components
- Keep security best practices in mind (environment variables, data validation)
