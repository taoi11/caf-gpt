# Cloudflare AI Gateway

## Usage

### Basic
```bash
curl https://gateway.ai.cloudflare.com/v1/{account_id}/caf-gpt -X POST \
  --header 'Content-Type: application/json' \
  --data '[ \
  { \
    "provider": "workers-ai", \
    "endpoint": "@cf/meta/llama-3.1-8b-instruct", \
    "headers": { \
      "Authorization": "Bearer XXXX", \
      "Content-Type": "application/json" \
    }, \
    "query": { \
      "messages": [ \
        { \
          "role": "system", \
          "content": "You are a friendly assistant" \
        }, \
        { \
          "role": "user", \
          "content": "Why is pizza so good" \
        } \
      ] \
    } \
  }, \
  { \ # fallback
    "provider": "openai", \
    "endpoint": "chat/completions", \
    "headers": { \
      "Authorization": "Bearer XXXX", \
      "Content-Type": "application/json" \
    }, \
    "query": { \
      "model": "gpt-3.5-turbo", \
      "messages": [ \
        { \
          "role": "user", \
          "content": "What is Cloudflare?" \
        } \
      ] \
    } \
  } \
]'
```

### Auth 
this always needed as the gateway is set my me to require auth
``` bash
--header 'cf-aig-authorization: Bearer {CF_AIG_TOKEN}' \
```

### OpenRouter 
``` bash
curl -X POST https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/openrouter/v1/chat/completions \
 --header 'content-type: application/json' \
 --header 'Authorization: Bearer OPENROUTER_TOKEN' \
 --data '{
    "model": "openai/gpt-3.5-turbo",
    "messages": [
        {
            "role": "user",
            "content": "What is Cloudflare?"
        }
    ]
}'
```