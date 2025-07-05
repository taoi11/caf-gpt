package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"caf-gpt/internal/services"
)

// PaceNoteResultData represents data for pacenote results partial
type PaceNoteResultData struct {
	Error    string          `json:"error,omitempty"`
	Feedback string          `json:"feedback,omitempty"`
	Rank     string          `json:"rank,omitempty"`
	Usage    *services.Usage `json:"usage,omitempty"`
}

// PolicyResponseData represents data for policy response partial
type PolicyResponseData struct {
	Error    string                   `json:"error,omitempty"`
	Messages []services.PolicyMessage `json:"messages,omitempty"`
}

// PaceNoteGenerateHandler handles HTMX requests for pace note generation
func (h *Handlers) PaceNoteGenerateHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Check configuration
	if !h.config.IsConfigured() {
		data := PaceNoteResultData{
			Error: "Application is not properly configured. Please check environment variables.",
		}
		h.renderPaceNoteResults(w, data)
		return
	}

	// Parse form data
	if err := r.ParseForm(); err != nil {
		data := PaceNoteResultData{
			Error: "Failed to parse form data",
		}
		h.renderPaceNoteResults(w, data)
		return
	}

	// Extract form values
	rank := r.FormValue("rank")
	observations := r.FormValue("observations")
	competencyFocus := r.Form["competency_focus"]

	// Validate required fields
	if rank == "" {
		data := PaceNoteResultData{
			Error: "Rank is required",
		}
		h.renderPaceNoteResults(w, data)
		return
	}

	if strings.TrimSpace(observations) == "" {
		data := PaceNoteResultData{
			Error: "Observations are required",
		}
		h.renderPaceNoteResults(w, data)
		return
	}

	// Create input
	input := &services.PaceNoteInput{
		Rank:            services.PaceNoteRank(rank),
		Observations:    observations,
		CompetencyFocus: competencyFocus,
	}

	// Generate pace note
	result, err := h.paceNoteService.GeneratePaceNote(r.Context(), input)
	if err != nil {
		log.Printf("PaceNote generation error: %v", err)
		data := PaceNoteResultData{
			Error: "Failed to generate pace note: " + err.Error(),
		}
		h.renderPaceNoteResults(w, data)
		return
	}

	// Return success
	data := PaceNoteResultData{
		Feedback: result.Feedback,
		Rank:     result.Rank,
		Usage:    &result.Usage,
	}
	h.renderPaceNoteResults(w, data)
}

// PolicyAskHandler handles HTMX requests for policy questions
func (h *Handlers) PolicyAskHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Check configuration
	if !h.config.IsConfigured() {
		data := PolicyResponseData{
			Error: "Application is not properly configured. Please check environment variables.",
		}
		h.renderPolicyResponse(w, data)
		return
	}

	// Parse form data
	if err := r.ParseForm(); err != nil {
		data := PolicyResponseData{
			Error: "Failed to parse form data",
		}
		h.renderPolicyResponse(w, data)
		return
	}

	// Extract form values
	userMessage := strings.TrimSpace(r.FormValue("user_message"))
	policySet := r.FormValue("policy_set")
	messagesJson := r.FormValue("messages")

	// Validate required fields
	if userMessage == "" {
		data := PolicyResponseData{
			Error: "Message cannot be empty",
		}
		h.renderPolicyResponse(w, data)
		return
	}

	if policySet == "" {
		data := PolicyResponseData{
			Error: "Policy set is required",
		}
		h.renderPolicyResponse(w, data)
		return
	}

	// Parse existing messages
	var messages []services.PolicyMessage
	if messagesJson != "" {
		if err := json.Unmarshal([]byte(messagesJson), &messages); err != nil {
			log.Printf("Failed to parse messages: %v", err)
			// Continue with empty messages
		}
	}

	// Add new user message
	messages = append(messages, services.PolicyMessage{
		Role:      "user",
		Content:   userMessage,
		Timestamp: time.Now().Unix(),
	})

	// Create input
	input := &services.PolicyQueryInput{
		Messages:  messages,
		PolicySet: services.PolicySet(policySet),
	}

	// Process query
	result, err := h.policyService.ProcessQuery(r.Context(), input)
	if err != nil {
		log.Printf("Policy query error: %v", err)
		data := PolicyResponseData{
			Error: "Failed to process query: " + err.Error(),
		}
		h.renderPolicyResponse(w, data)
		return
	}

	// Add assistant response to messages
	messages = append(messages, services.PolicyMessage{
		Role:      "assistant",
		Content:   result.Message,
		Timestamp: result.Timestamp.Unix(),
	})

	// Return success
	data := PolicyResponseData{
		Messages: messages,
	}
	h.renderPolicyResponse(w, data)
}

// PolicyClearHandler handles clearing the conversation
func (h *Handlers) PolicyClearHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Return empty conversation state
	w.Header().Set("Content-Type", "text/html")
	w.Write([]byte(`
		<div class="p-8 text-center">
			<h2 class="text-2xl font-semibold text-gray-800 mb-3">Ask a Policy Question</h2>
			<p class="text-gray-600 mb-6">Select a policy set and ask your question to get started.</p>
			<div class="max-w-md mx-auto text-left bg-gray-50 p-4 rounded-lg">
				<h3 class="font-semibold text-gray-700 mb-2">Example Questions:</h3>
				<ul class="text-sm text-gray-600 space-y-1">
					<li>• What are the leave approval requirements?</li>
					<li>• How do I request compassionate leave?</li>
					<li>• What is the policy on professional development?</li>
				</ul>
			</div>
		</div>
	`))
}

// Helper methods

func (h *Handlers) renderPaceNoteResults(w http.ResponseWriter, data PaceNoteResultData) {
	w.Header().Set("Content-Type", "text/html")
	if err := h.templates.ExecuteTemplate(w, "pacenote_results.html", data); err != nil {
		log.Printf("Template execution error: %v", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
	}
}

func (h *Handlers) renderPolicyResponse(w http.ResponseWriter, data PolicyResponseData) {
	w.Header().Set("Content-Type", "text/html")
	if err := h.templates.ExecuteTemplate(w, "policy_response.html", data); err != nil {
		log.Printf("Template execution error: %v", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
	}
}
