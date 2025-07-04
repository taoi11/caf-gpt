package main

import (
	"context"
	"embed"
	"html/template"
	"log"
	"net/http"
	"path/filepath"

	"caf-gpt/internal/config"
	"caf-gpt/internal/handlers"
	"caf-gpt/internal/services"
	"caf-gpt/internal/storage"
)

//go:embed internal/templates
var templateFS embed.FS

//go:embed static
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

	// Static files
	mux.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.FS(staticFS))))

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
	log.Printf("Server starting on :%s", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, handler); err != nil {
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