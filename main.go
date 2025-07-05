package main

import (
	"context"
	"embed"
	"html/template"
	"log"
	"mime"
	"net/http"
	"path/filepath"
	"strings"

	"caf-gpt/internal/config"
	"caf-gpt/internal/handlers"
	"caf-gpt/internal/services"
	"caf-gpt/internal/storage"
)

//go:embed internal/templates
var templateFS embed.FS

//go:embed static/*
var staticFS embed.FS

// Note: Prompt files are read from Tigris storage, not embedded

func main() {
	// Load configuration
	cfg := config.Load()

	log.Printf("Starting CAF GPT server on port %s", cfg.Port)
	log.Printf("Configuration status: %v", cfg.IsConfigured())

	// Initialize services
	ctx := context.Background()

	var tigrisClient *storage.TigrisClient
	var openRouterClient *services.OpenRouterClient
	var paceNoteService *services.PaceNoteService
	var policyService *services.PolicyService

	if cfg.IsConfigured() {
		// Initialize Tigris client
		var err error
		tigrisClient, err = storage.NewTigrisClient(
			ctx,
			cfg.TigrisAccessKey,
			cfg.TigrisSecretKey,
			cfg.TigrisEndpoint,
			cfg.TigrisRegion,
			cfg.TigrisBucketName,
		)
		if err != nil {
			log.Printf("Warning: Failed to initialize Tigris client: %v", err)
		}

		// Initialize OpenRouter client
		openRouterClient = services.NewOpenRouterClient(cfg.OpenRouterAPIKey)

		// Initialize services
		if tigrisClient != nil && openRouterClient != nil {
			paceNoteService = services.NewPaceNoteService(openRouterClient, tigrisClient, cfg.PaceNoteModel)
			policyService = services.NewPolicyService(openRouterClient, tigrisClient, cfg.PolicyReaderModel, cfg.PolicyMainModel)
		}
	}

	// Parse templates
	templates, err := parseTemplates()
	if err != nil {
		log.Fatalf("Failed to parse templates: %v", err)
	}

	// Initialize handlers
	h := handlers.NewHandlers(cfg, paceNoteService, policyService, templates)

	// Set up routes
	mux := http.NewServeMux()

	// Static files with proper MIME types
	mux.HandleFunc("/static/", staticFileHandler)

	// Page routes
	mux.HandleFunc("/", h.HomeHandler)
	mux.HandleFunc("/pacenote", h.PaceNoteHandler)
	mux.HandleFunc("/policy", h.PolicyHandler)

	// HTMX partial routes
	mux.HandleFunc("/pacenote/generate", h.PaceNoteGenerateHandler)
	mux.HandleFunc("/policy/ask", h.PolicyAskHandler)
	mux.HandleFunc("/policy/clear", h.PolicyClearHandler)

	// Health check
	mux.HandleFunc("/health", h.HealthHandler)

	// Add CORS and security headers middleware
	handler := addMiddleware(mux)

	// Start server
	log.Printf("Server starting on 0.0.0.0:%s", cfg.Port)
	if err := http.ListenAndServe("0.0.0.0:"+cfg.Port, handler); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}

// parseTemplates parses all embedded templates
func parseTemplates() (*template.Template, error) {
	tmpl := template.New("")

	// Parse base layout
	layoutContent, err := templateFS.ReadFile("internal/templates/base/layout.html")
	if err != nil {
		return nil, err
	}

	// Parse layout template
	_, err = tmpl.New("layout.html").Parse(string(layoutContent))
	if err != nil {
		return nil, err
	}

	// Parse page templates
	pageFiles := []string{
		"internal/templates/pages/index.html",
		"internal/templates/pages/pacenote.html",
		"internal/templates/pages/policy.html",
	}

	for _, file := range pageFiles {
		content, err := templateFS.ReadFile(file)
		if err != nil {
			return nil, err
		}

		name := filepath.Base(file)
		_, err = tmpl.New(name).Parse(string(content))
		if err != nil {
			return nil, err
		}
	}

	// Parse partial templates
	partialFiles := []string{
		"internal/templates/partials/pacenote_results.html",
		"internal/templates/partials/policy_response.html",
	}

	for _, file := range partialFiles {
		content, err := templateFS.ReadFile(file)
		if err != nil {
			return nil, err
		}

		name := filepath.Base(file)
		_, err = tmpl.New(name).Parse(string(content))
		if err != nil {
			return nil, err
		}
	}

	return tmpl, nil
}

// staticFileHandler serves static files with proper MIME types
func staticFileHandler(w http.ResponseWriter, r *http.Request) {
	// Remove /static/ prefix to get the relative path
	path := strings.TrimPrefix(r.URL.Path, "/static/")
	if path == r.URL.Path {
		// Path didn't start with /static/
		http.NotFound(w, r)
		return
	}

	// Sanitize the path to prevent directory traversal
	cleaned := filepath.Clean(path)
	if strings.HasPrefix(cleaned, "..") {
		http.NotFound(w, r)
		return
	}

	// Construct the full path in the embedded filesystem
	embeddedPath := "static/" + cleaned

	// Get file extension and set appropriate MIME type
	ext := strings.ToLower(filepath.Ext(path))
	switch ext {
	case ".css":
		w.Header().Set("Content-Type", "text/css; charset=utf-8")
	case ".js":
		w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
	case ".png":
		w.Header().Set("Content-Type", "image/png")
	case ".jpg", ".jpeg":
		w.Header().Set("Content-Type", "image/jpeg")
	case ".gif":
		w.Header().Set("Content-Type", "image/gif")
	case ".svg":
		w.Header().Set("Content-Type", "image/svg+xml")
	case ".ico":
		w.Header().Set("Content-Type", "image/x-icon")
	default:
		// Use Go's built-in MIME type detection as fallback
		if mimeType := mime.TypeByExtension(ext); mimeType != "" {
			w.Header().Set("Content-Type", mimeType)
		}
	}

	// Read the file directly from embedded filesystem
	content, err := staticFS.ReadFile(embeddedPath)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	// Set Cache-Control header for static assets (1 week)
	w.Header().Set("Cache-Control", "public, max-age=604800, immutable")

	// Set ETag header based on file content hash
	etag := `W/"` + computeETag(content) + `"`
	w.Header().Set("ETag", etag)

	// Handle If-None-Match for client-side caching
	if match := r.Header.Get("If-None-Match"); match != "" {
		if match == etag {
			w.WriteHeader(http.StatusNotModified)
			return
		}
	}

	w.Write(content)
}

// computeETag returns a weak ETag for the given content
func computeETag(content []byte) string {
	// Use a simple hash for ETag (not cryptographically secure)
	const prime32 = 16777619
	var hash uint32 = 2166136261
	for _, b := range content {
		hash ^= uint32(b)
		hash *= prime32
	}
	return strings.ToUpper(hexEncode(hash))
}

// hexEncode returns the hex string of a uint32
func hexEncode(u uint32) string {
	const hex = "0123456789ABCDEF"
	b := make([]byte, 8)
	for i := 7; i >= 0; i-- {
		b[i] = hex[u&0xF]
		u >>= 4
	}
	return string(b)
}

// addMiddleware adds CORS and security headers
func addMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// CORS headers
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, HX-Request, HX-Target, HX-Current-URL")

		// Security headers
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("X-XSS-Protection", "1; mode=block")

		// Handle preflight requests
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}
