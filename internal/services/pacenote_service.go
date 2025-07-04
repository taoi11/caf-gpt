package services

import (
	"context"
	"fmt"
	"strings"
	"time"

	"caf-gpt/internal/storage"
)

// PaceNoteRank represents valid CAF ranks
type PaceNoteRank string

const (
	RankCpl  PaceNoteRank = "Cpl"
	RankMCpl PaceNoteRank = "MCpl"
	RankSgt  PaceNoteRank = "Sgt"
	RankWO   PaceNoteRank = "WO"
)

// RankInfo contains rank display information
type RankInfo struct {
	Value string `json:"value"`
	Label string `json:"label"`
}

// PaceNoteInput represents input for pace note generation
type PaceNoteInput struct {
	Rank            PaceNoteRank `json:"rank"`
	Observations    string       `json:"observations"`
	CompetencyFocus []string     `json:"competency_focus,omitempty"`
}

// PaceNoteOutput represents the generated pace note
type PaceNoteOutput struct {
	Feedback    string    `json:"feedback"`
	Rank        string    `json:"rank"`
	GeneratedAt time.Time `json:"generated_at"`
	Usage       Usage     `json:"usage"`
}

// PaceNoteService handles pace note generation
type PaceNoteService struct {
	openRouter *OpenRouterClient
	storage    *storage.TigrisClient
	model      string
}

// NewPaceNoteService creates a new pace note service
func NewPaceNoteService(openRouter *OpenRouterClient, storage *storage.TigrisClient, model string) *PaceNoteService {
	return &PaceNoteService{
		openRouter: openRouter,
		storage:    storage,
		model:      model,
	}
}

// GetAvailableRanks returns the list of available ranks
func (s *PaceNoteService) GetAvailableRanks() []RankInfo {
	return []RankInfo{
		{Value: "Cpl", Label: "Corporal (Cpl)"},
		{Value: "MCpl", Label: "Master Corporal (MCpl)"},
		{Value: "Sgt", Label: "Sergeant (Sgt)"},
		{Value: "WO", Label: "Warrant Officer (WO)"},
	}
}

// ValidateInput validates pace note input
func (s *PaceNoteService) ValidateInput(input *PaceNoteInput) error {
	validRanks := map[PaceNoteRank]bool{
		RankCpl: true, RankMCpl: true, RankSgt: true, RankWO: true,
	}

	if !validRanks[input.Rank] {
		return fmt.Errorf("invalid rank: %s", input.Rank)
	}

	if len(strings.TrimSpace(input.Observations)) < 20 {
		return fmt.Errorf("observations must be at least 20 characters long")
	}

	if len(input.Observations) > 2000 {
		return fmt.Errorf("observations must be less than 2000 characters")
	}

	return nil
}

// GeneratePaceNote generates a pace note based on input
func (s *PaceNoteService) GeneratePaceNote(ctx context.Context, input *PaceNoteInput) (*PaceNoteOutput, error) {
	// Validate input
	if err := s.ValidateInput(input); err != nil {
		return nil, fmt.Errorf("validation error: %w", err)
	}

	// Build system prompt
	systemPrompt, err := s.buildSystemPrompt(ctx, input.Rank, input.CompetencyFocus)
	if err != nil {
		return nil, fmt.Errorf("failed to build system prompt: %w", err)
	}

	// Generate using OpenRouter
	response, err := s.openRouter.GenerateFromPrompt(
		ctx,
		s.model,
		systemPrompt,
		strings.TrimSpace(input.Observations),
		0.1, // Low temperature for consistent output
	)
	if err != nil {
		return nil, fmt.Errorf("failed to generate pace note: %w", err)
	}

	if len(response.Choices) == 0 {
		return nil, fmt.Errorf("no response generated")
	}

	return &PaceNoteOutput{
		Feedback:    response.Choices[0].Message.Content,
		Rank:        string(input.Rank),
		GeneratedAt: time.Now(),
		Usage: Usage{
			PromptTokens:     response.Usage.PromptTokens,
			CompletionTokens: response.Usage.CompletionTokens,
			TotalTokens:      response.Usage.TotalTokens,
		},
	}, nil
}

// buildSystemPrompt builds the system prompt with competencies and examples
func (s *PaceNoteService) buildSystemPrompt(ctx context.Context, rank PaceNoteRank, competencyFocus []string) (string, error) {
	// Read base prompt template
	basePrompt, err := s.readPromptFile(ctx, "pacenote/prompts/base.md")
	if err != nil {
		return "", fmt.Errorf("failed to read base prompt: %w", err)
	}

	// Get competencies for rank
	competencies, err := s.getCompetenciesForRank(ctx, rank)
	if err != nil {
		return "", fmt.Errorf("failed to get competencies: %w", err)
	}

	// Get examples
	examples, err := s.getExamples(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to get examples: %w", err)
	}

	// Replace placeholders in base template
	systemPrompt := strings.ReplaceAll(basePrompt, "{{competency_list}}", competencies)
	systemPrompt = strings.ReplaceAll(systemPrompt, "{{examples}}", examples)

	// Add specific competency focus if provided
	if len(competencyFocus) > 0 {
		focusAreas := strings.Join(competencyFocus, ", ")
		systemPrompt += fmt.Sprintf("\n\nSPECIFIC COMPETENCY FOCUS: Pay particular attention to %s", focusAreas)
	}

	return systemPrompt, nil
}

// readPromptFile reads a prompt file from embedded prompts
func (s *PaceNoteService) readPromptFile(ctx context.Context, path string) (string, error) {
	// For now, we'll read from storage. In the final version, this will be embedded
	return s.storage.ReadFile(ctx, path)
}

// getCompetenciesForRank gets competencies for a specific rank
func (s *PaceNoteService) getCompetenciesForRank(ctx context.Context, rank PaceNoteRank) (string, error) {
	filePath := fmt.Sprintf("paceNote/%s.md", strings.ToLower(string(rank)))
	return s.storage.ReadFile(ctx, filePath)
}

// getExamples gets example pace notes
func (s *PaceNoteService) getExamples(ctx context.Context) (string, error) {
	return s.storage.ReadFile(ctx, "paceNote/examples.md")
}