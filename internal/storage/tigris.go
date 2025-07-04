package storage

import (
	"context"
	"fmt"
	"io"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// TigrisClient wraps the S3 client for Tigris operations
type TigrisClient struct {
	client     *s3.Client
	bucketName string
}

// NewTigrisClient creates a new Tigris S3 client
func NewTigrisClient(ctx context.Context, accessKey, secretKey, endpoint, region, bucketName string) (*TigrisClient, error) {
	// Create AWS config with custom credentials and endpoint
	cfg, err := config.LoadDefaultConfig(ctx,
		config.WithCredentialsProvider(aws.CredentialsProviderFunc(func(ctx context.Context) (aws.Credentials, error) {
			return aws.Credentials{
				AccessKeyID:     accessKey,
				SecretAccessKey: secretKey,
			}, nil
		})),
		config.WithRegion(region),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to load AWS config: %w", err)
	}

	// Create S3 client with custom endpoint for Tigris
	client := s3.NewFromConfig(cfg, func(o *s3.Options) {
		o.BaseEndpoint = aws.String(endpoint)
		o.UsePathStyle = true
	})

	return &TigrisClient{
		client:     client,
		bucketName: bucketName,
	}, nil
}

// ReadFile reads a file from Tigris storage and returns its content as a string
func (tc *TigrisClient) ReadFile(ctx context.Context, key string) (string, error) {
	// Get object from S3
	result, err := tc.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(tc.bucketName),
		Key:    aws.String(key),
	})
	if err != nil {
		return "", fmt.Errorf("failed to get object %s: %w", key, err)
	}
	defer result.Body.Close()

	// Read the content
	content, err := io.ReadAll(result.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read object content: %w", err)
	}

	return string(content), nil
}

// WriteFile writes content to a file in Tigris storage
func (tc *TigrisClient) WriteFile(ctx context.Context, key, content string) error {
	_, err := tc.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket: aws.String(tc.bucketName),
		Key:    aws.String(key),
		Body:   strings.NewReader(content),
	})
	if err != nil {
		return fmt.Errorf("failed to put object %s: %w", key, err)
	}

	return nil
}

// FileExists checks if a file exists in Tigris storage
func (tc *TigrisClient) FileExists(ctx context.Context, key string) (bool, error) {
	_, err := tc.client.HeadObject(ctx, &s3.HeadObjectInput{
		Bucket: aws.String(tc.bucketName),
		Key:    aws.String(key),
	})
	if err != nil {
		// Check if it's a "not found" error
		if strings.Contains(err.Error(), "NotFound") || strings.Contains(err.Error(), "404") {
			return false, nil
		}
		return false, fmt.Errorf("failed to check object existence: %w", err)
	}

	return true, nil
}