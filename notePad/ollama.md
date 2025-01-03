Here's a distilled quick reference for Ollama API integration:

# Ollama API Quick Reference

## Base URL
`http://localhost:11434/api`

## Core Endpoints Summary

### Text Generation
```http
POST /api/generate
{
  "model": "model_name",     # required
  "prompt": "your_prompt",
  "stream": true/false,      # default: true
  "raw": true/false,        # bypass templating
  "format": "json",         # or JSON schema
  "options": {
    "temperature": 0.7,
    "seed": 123,            # for reproducibility
    "num_predict": 100,
    # ... other model parameters
  }
}
```

### Chat Completion
```http
POST /api/chat
{
  "model": "model_name",     # required
  "messages": [
    {
      "role": "user/assistant/system",
      "content": "message",
      "images": ["base64_encoded_images"]  # optional
    }
  ],
  "stream": true/false,
  "format": "json",         # or JSON schema
  "options": {}            # same as generate
}
```

### Embeddings
```http
POST /api/embed
{
  "model": "model_name",
  "input": "text" | ["text1", "text2"],
  "truncate": true         # default: true
}
```

## Model Management

### Create Model
```http
POST /api/create
{
  "model": "name",
  "modelfile": "FROM llama2...",
  "stream": true/false
}
```

### List Models
```http
GET /api/tags
GET /api/ps        # running models
```

### Model Operations
```http
POST /api/pull     # download model
POST /api/push     # upload model
POST /api/copy     # copy model
DELETE /api/delete # delete model
POST /api/show     # model info
```

## Important Parameters

### Common Options
```json
{
  "temperature": 0.8,
  "top_k": 20,
  "top_p": 0.9,
  "num_ctx": 1024,
  "seed": 123,
  "num_predict": 100,
  "stop": ["\n", "user:"],
  "keep_alive": "5m"
}
```

### Response Format Control
```json
{
  "format": "json",
  "format": {
    "type": "object",
    "properties": {
      "key": {"type": "string"}
    }
  }
}
```

## Response Structure

### Generation/Chat Response
```json
{
  "model": "model_name",
  "created_at": "timestamp",
  "response": "content",      # empty if streaming
  "done": true,
  "context": [1,2,3],        # conversation context
  "total_duration": 1000000,  # nanoseconds
  "load_duration": 100000,
  "prompt_eval_count": 10,
  "eval_count": 50,
  "eval_duration": 900000
}
```

### Embedding Response
```json
{
  "embeddings": [[0.1, 0.2, ...]],
  "total_duration": 14143917,
  "load_duration": 1019500,
  "prompt_eval_count": 8
}
```
