package handlers

import (
	"html/template"
	"net/http"
	"strings"

	"caf-gpt/internal/config"
	"caf-gpt/internal/services"
)

// PageData represents common data for all pages
type PageData struct {
	Title       string
	Description string
	Content     template.HTML
}

// PaceNotePageData represents data for the pacenote page
type PaceNotePageData struct {
	Title          string
	Description    string
	AvailableRanks []services.RankInfo
	IsConfigured   bool
}

// PolicyPageData represents data for the policy page
type PolicyPageData struct {
	Title       string
	Description string
	PolicySets  []string
}

// Handlers holds all the handler dependencies
type Handlers struct {
	config          *config.Config
	paceNoteService *services.PaceNoteService
	policyService   *services.PolicyService
	templates       *template.Template
}

// NewHandlers creates a new handlers instance
func NewHandlers(cfg *config.Config, paceNoteService *services.PaceNoteService, policyService *services.PolicyService, templates *template.Template) *Handlers {
	return &Handlers{
		config:          cfg,
		paceNoteService: paceNoteService,
		policyService:   policyService,
		templates:       templates,
	}
}

// HomeHandler handles the home page
func (h *Handlers) HomeHandler(w http.ResponseWriter, r *http.Request) {
	// Get the index content
	var contentBuf strings.Builder
	if err := h.templates.ExecuteTemplate(&contentBuf, "index.html", nil); err != nil {
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	data := PageData{
		Title:       "Home",
		Description: "AI-powered tools for Canadian Armed Forces personnel including pace note generation and policy assistance.",
		Content:     template.HTML(contentBuf.String()),
	}

	// Execute the layout template
	if err := h.templates.ExecuteTemplate(w, "layout.html", data); err != nil {
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}
}

// PaceNoteHandler handles the pacenote page
func (h *Handlers) PaceNoteHandler(w http.ResponseWriter, r *http.Request) {
	pageData := PaceNotePageData{
		Title:          "PaceNote Generator",
		Description:    "Generate professional pace notes using AI with rank-specific competency frameworks.",
		AvailableRanks: h.paceNoteService.GetAvailableRanks(),
		IsConfigured:   h.config.IsConfigured(),
	}

	// Get the pacenote content
	var contentBuf strings.Builder
	if err := h.templates.ExecuteTemplate(&contentBuf, "pacenote.html", pageData); err != nil {
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	data := PageData{
		Title:       pageData.Title,
		Description: pageData.Description,
		Content:     template.HTML(contentBuf.String()),
	}

	// Execute the layout template
	if err := h.templates.ExecuteTemplate(w, "layout.html", data); err != nil {
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}
}

// PolicyHandler handles the policy page
func (h *Handlers) PolicyHandler(w http.ResponseWriter, r *http.Request) {
	pageData := PolicyPageData{
		Title:       "Policy Assistant",
		Description: "Ask questions about CAF policies and get authoritative answers with citations.",
		PolicySets:  h.policyService.GetSupportedPolicySets(),
	}

	// Get the policy content
	var contentBuf strings.Builder
	if err := h.templates.ExecuteTemplate(&contentBuf, "policy.html", pageData); err != nil {
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	data := PageData{
		Title:       pageData.Title,
		Description: pageData.Description,
		Content:     template.HTML(contentBuf.String()),
	}

	// Execute the layout template
	if err := h.templates.ExecuteTemplate(w, "layout.html", data); err != nil {
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}
}