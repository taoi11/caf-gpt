package services

import (
	"context"
	"fmt"
	"strings"
	"time"

	"caf-gpt/internal/storage"
)

// PolicySet represents supported policy sets
type PolicySet string

const (
	PolicyDOAD  PolicySet = "DOAD"
	PolicyLeave PolicySet = "LEAVE"
)

// PolicyMessage represents a message in the conversation
type PolicyMessage struct {
	Role      string `json:"role"`
	Content   string `json:"content"`
	Timestamp int64  `json:"timestamp,omitempty"`
}

// PolicyQueryInput represents input for policy queries
type PolicyQueryInput struct {
	Messages  []PolicyMessage `json:"messages"`
	PolicySet PolicySet       `json:"policy_set"`
}

// PolicyQueryOutput represents the output from policy queries
type PolicyQueryOutput struct {
	Message   string    `json:"message"`
	Timestamp time.Time `json:"timestamp"`
	Usage     struct {
		Finder *Usage `json:"finder,omitempty"`
		Main   *Usage `json:"main,omitempty"`
	} `json:"usage,omitempty"`
}

// PolicyService handles policy question answering
type PolicyService struct {
	openRouter  *OpenRouterClient
	storage     *storage.TigrisClient
	readerModel string
	mainModel   string
}

// NewPolicyService creates a new policy service
func NewPolicyService(openRouter *OpenRouterClient, storage *storage.TigrisClient, readerModel, mainModel string) *PolicyService {
	return &PolicyService{
		openRouter:  openRouter,
		storage:     storage,
		readerModel: readerModel,
		mainModel:   mainModel,
	}
}

// GetSupportedPolicySets returns the list of supported policy sets
func (s *PolicyService) GetSupportedPolicySets() []string {
	return []string{"DOAD", "LEAVE"}
}

// ValidateInput validates policy query input
func (s *PolicyService) ValidateInput(input *PolicyQueryInput) error {
	if input.PolicySet != PolicyDOAD && input.PolicySet != PolicyLeave {
		return fmt.Errorf("invalid policy set: %s", input.PolicySet)
	}

	if len(input.Messages) == 0 {
		return fmt.Errorf("messages cannot be empty")
	}

	// Validate individual messages
	for _, msg := range input.Messages {
		if msg.Role != "user" && msg.Role != "assistant" && msg.Role != "system" {
			return fmt.Errorf("invalid message role: %s", msg.Role)
		}
		if strings.TrimSpace(msg.Content) == "" {
			return fmt.Errorf("message content cannot be empty")
		}
		if len(msg.Content) > 4000 {
			return fmt.Errorf("message content too long: %d characters", len(msg.Content))
		}
	}

	// Check total conversation length
	totalLength := 0
	for _, msg := range input.Messages {
		totalLength += len(msg.Content)
	}
	if totalLength > 20000 {
		return fmt.Errorf("total conversation length too long: %d characters", totalLength)
	}

	return nil
}

// ProcessQuery processes a policy query
func (s *PolicyService) ProcessQuery(ctx context.Context, input *PolicyQueryInput) (*PolicyQueryOutput, error) {
	// Validate input
	if err := s.ValidateInput(input); err != nil {
		return nil, fmt.Errorf("validation error: %w", err)
	}

	// Route to appropriate policy handler
	switch input.PolicySet {
	case PolicyDOAD:
		return s.handleDOADQuery(ctx, input)
	case PolicyLeave:
		return s.handleLeaveQuery(ctx, input)
	default:
		return nil, fmt.Errorf("unsupported policy set: %s", input.PolicySet)
	}
}

// handleDOADQuery handles DOAD policy queries
func (s *PolicyService) handleDOADQuery(ctx context.Context, input *PolicyQueryInput) (*PolicyQueryOutput, error) {
	// Read prompts
	finderPrompt, err := s.readPromptFile(ctx, "policy/doad/prompts/finder.md")
	if err != nil {
		return nil, fmt.Errorf("failed to read finder prompt: %w", err)
	}

	mainPrompt, err := s.readPromptFile(ctx, "policy/doad/prompts/main.md")
	if err != nil {
		return nil, fmt.Errorf("failed to read main prompt: %w", err)
	}

	policyListTable, err := s.readPromptFile(ctx, "policy/doad/prompts/DOAD-list-table.md")
	if err != nil {
		return nil, fmt.Errorf("failed to read policy list: %w", err)
	}

	// Step 1: Find relevant policies using finder agent
	policyNumbers, finderUsage, err := s.findRelevantPolicies(ctx, input.Messages, finderPrompt, policyListTable)
	if err != nil {
		return nil, fmt.Errorf("failed to find relevant policies: %w", err)
	}

	// Step 2: Read policy content
	policyContent, err := s.readPolicyContent(ctx, "doad", policyNumbers)
	if err != nil {
		return nil, fmt.Errorf("failed to read policy content: %w", err)
	}

	// Step 3: Generate response using main agent
	response, mainUsage, err := s.generatePolicyResponse(ctx, input.Messages, mainPrompt, policyContent)
	if err != nil {
		return nil, fmt.Errorf("failed to generate response: %w", err)
	}

	return &PolicyQueryOutput{
		Message:   response,
		Timestamp: time.Now(),
		Usage: struct {
			Finder *Usage `json:"finder,omitempty"`
			Main   *Usage `json:"main,omitempty"`
		}{
			Finder: finderUsage,
			Main:   mainUsage,
		},
	}, nil
}

// handleLeaveQuery handles Leave policy queries
func (s *PolicyService) handleLeaveQuery(ctx context.Context, input *PolicyQueryInput) (*PolicyQueryOutput, error) {
	// Read main prompt for leave policies
	mainPrompt, err := s.readPromptFile(ctx, "policy/leave/prompts/main.md")
	if err != nil {
		return nil, fmt.Errorf("failed to read main prompt: %w", err)
	}

	// For leave policies, we use a simpler approach without the finder agent
	// Read all leave policy content
	policyContent, err := s.readAllLeavePolicies(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to read leave policies: %w", err)
	}

	// Generate response using main agent
	response, mainUsage, err := s.generatePolicyResponse(ctx, input.Messages, mainPrompt, []string{policyContent})
	if err != nil {
		return nil, fmt.Errorf("failed to generate response: %w", err)
	}

	return &PolicyQueryOutput{
		Message:   response,
		Timestamp: time.Now(),
		Usage: struct {
			Finder *Usage `json:"finder,omitempty"`
			Main   *Usage `json:"main,omitempty"`
		}{
			Main: mainUsage,
		},
	}, nil
}

// findRelevantPolicies uses the finder agent to identify relevant policy numbers
func (s *PolicyService) findRelevantPolicies(ctx context.Context, messages []PolicyMessage, finderPrompt, policyListTable string) ([]string, *Usage, error) {
	// Build conversation context
	conversationContext := s.buildConversationContext(messages)

	// Create finder system prompt
	systemPrompt := finderPrompt + "\n\n" + policyListTable

	// Generate using finder model
	response, err := s.openRouter.GenerateFromPrompt(
		ctx,
		s.readerModel,
		systemPrompt,
		conversationContext,
		0.1,
	)
	if err != nil {
		return nil, nil, err
	}

	if len(response.Choices) == 0 {
		return nil, nil, fmt.Errorf("no response from finder agent")
	}

	// Parse policy numbers from response
	policyNumbers := s.parsePolicyNumbers(response.Choices[0].Message.Content)

	usage := &Usage{
		PromptTokens:     response.Usage.PromptTokens,
		CompletionTokens: response.Usage.CompletionTokens,
		TotalTokens:      response.Usage.TotalTokens,
	}

	return policyNumbers, usage, nil
}

// generatePolicyResponse generates the final response using the main agent
func (s *PolicyService) generatePolicyResponse(ctx context.Context, messages []PolicyMessage, mainPrompt string, policyContent []string) (string, *Usage, error) {
	// Build conversation context
	conversationContext := s.buildConversationContext(messages)

	// Build system prompt with policy content
	systemPrompt := mainPrompt + "\n\nPOLICY CONTENT:\n" + strings.Join(policyContent, "\n\n")

	// Generate using main model
	response, err := s.openRouter.GenerateFromPrompt(
		ctx,
		s.mainModel,
		systemPrompt,
		conversationContext,
		0.1,
	)
	if err != nil {
		return "", nil, err
	}

	if len(response.Choices) == 0 {
		return "", nil, fmt.Errorf("no response from main agent")
	}

	usage := &Usage{
		PromptTokens:     response.Usage.PromptTokens,
		CompletionTokens: response.Usage.CompletionTokens,
		TotalTokens:      response.Usage.TotalTokens,
	}

	return response.Choices[0].Message.Content, usage, nil
}

// Helper methods

func (s *PolicyService) readPromptFile(ctx context.Context, path string) (string, error) {
	return s.storage.ReadFile(ctx, path)
}

func (s *PolicyService) buildConversationContext(messages []PolicyMessage) string {
	var parts []string
	for _, msg := range messages {
		parts = append(parts, fmt.Sprintf("%s: %s", strings.Title(msg.Role), msg.Content))
	}
	return strings.Join(parts, "\n\n")
}

func (s *PolicyService) parsePolicyNumbers(response string) []string {
	// Simple parsing - look for DOAD numbers in the response
	// This is a simplified version; the actual implementation would be more sophisticated
	var numbers []string
	lines := strings.Split(response, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.Contains(line, "DOAD") || strings.Contains(line, "DAOD") {
			// Extract policy numbers - this is simplified
			if len(line) > 0 {
				numbers = append(numbers, line)
			}
		}
	}
	return numbers
}

func (s *PolicyService) readPolicyContent(ctx context.Context, policyType string, policyNumbers []string) ([]string, error) {
	var content []string
	for _, number := range policyNumbers {
		// Construct file path based on policy number
		filePath := fmt.Sprintf("%s/%s.md", policyType, strings.ReplaceAll(number, " ", "_"))
		policyText, err := s.storage.ReadFile(ctx, filePath)
		if err != nil {
			// Log error but continue with other policies
			continue
		}
		content = append(content, policyText)
	}
	return content, nil
}

func (s *PolicyService) readAllLeavePolicies(ctx context.Context) (string, error) {
	// For leave policies, read a consolidated policy file
	return s.storage.ReadFile(ctx, "leave/consolidated_policies.md")
}