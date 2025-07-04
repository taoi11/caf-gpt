package config

import (
	"os"
)

// Config holds all application configuration
type Config struct {
	Port                string
	OpenRouterAPIKey    string
	TigrisAccessKey     string
	TigrisSecretKey     string
	TigrisEndpoint      string
	TigrisRegion        string
	TigrisBucketName    string
	PaceNoteModel       string
	PolicyReaderModel   string
	PolicyMainModel     string
}

// Load loads configuration from environment variables
func Load() *Config {
	return &Config{
		Port:                getEnv("PORT", "8080"),
		OpenRouterAPIKey:    getEnv("OPENROUTER_API_KEY", ""),
		TigrisAccessKey:     getEnv("AWS_ACCESS_KEY_ID", ""),
		TigrisSecretKey:     getEnv("AWS_SECRET_ACCESS_KEY", ""),
		TigrisEndpoint:      getEnv("AWS_ENDPOINT_URL_S3", "https://fly.storage.tigris.dev"),
		TigrisRegion:        getEnv("AWS_REGION", "auto"),
		TigrisBucketName:    getEnv("BUCKET_NAME", ""),
		PaceNoteModel:       getEnv("FN_MODEL", "anthropic/claude-3.5-sonnet"),
		PolicyReaderModel:   getEnv("READER_MODEL", "anthropic/claude-3.5-sonnet"),
		PolicyMainModel:     getEnv("MAIN_MODEL", "anthropic/claude-3.5-sonnet"),
	}
}

// IsConfigured checks if all required configuration is present
func (c *Config) IsConfigured() bool {
	return c.OpenRouterAPIKey != "" &&
		c.TigrisAccessKey != "" &&
		c.TigrisSecretKey != "" &&
		c.TigrisBucketName != ""
}

// getEnv gets an environment variable with a default value
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}