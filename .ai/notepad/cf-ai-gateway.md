# Changelog

URL: https://developers.cloudflare.com/ai-gateway/changelog/

import { ProductReleaseNotes } from "~/components";

{/* <!-- Actual content lives in /src/content/release-notes/ai-gateway.yaml. Update the file there for new entries to appear here. For more details, refer to https://developers.cloudflare.com/style-guide/documentation-content-strategy/content-types/changelog/#yaml-file --> */}

<ProductReleaseNotes />

---

# OpenAI Compatibility

URL: https://developers.cloudflare.com/ai-gateway/chat-completion/

Cloudflare's AI Gateway offers an OpenAI-compatible `/chat/completions` endpoint, enabling integration with multiple AI providers using a single URL. This feature simplifies the integration process, allowing for seamless switching between different models without significant code modifications.

## Endpoint URL

```txt
https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/compat/chat/completions
```

Replace `{account_id}` and `{gateway_id}` with your Cloudflare account and gateway IDs.

## Parameters

Switch providers by changing the `model` and `apiKey` parameters.

Specify the model using `{provider}/{model}` format. For example:

- `openai/gpt-4o-mini`
- `google-ai-studio/gemini-2.0-flash`
- `anthropic/claude-3-haiku`

## Examples

### OpenAI SDK

```js
import OpenAI from "openai";
const client = new OpenAI({
	apiKey: "YOUR_PROVIDER_API_KEY", // Provider API key
  // NOTE: the OpenAI client automatically adds /chat/completions to the end of the URL, you should not add it yourself.
	baseURL: "https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/compat",
});

const response = await client.chat.completions.create({
	model: "google-ai-studio/gemini-2.0-flash",
	messages: [{ role: "user", content: "What is Cloudflare?" }],
});

console.log(response.choices[0].message.content);
```

### cURL

```bash
curl -X POST https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/compat/chat/completions \
  --header 'Authorization: Bearer {openai_token}' \
  --header 'Content-Type: application/json' \
  --data '{
    "model": "google-ai-studio/gemini-2.0-flash",
    "messages": [
      {
        "role": "user",
        "content": "What is Cloudflare?"
      }
    ]
  }'
```

### Universal provider

You can also use this pattern with the [Universal Endpoint](/ai-gateway/universal/) to add [fallbacks](/ai-gateway/configuration/fallbacks/) across multiple providers. When used in combination, every request will return the same standardized format, whether from the primary or fallback model. This behavior means that you do not have to add extra parsing logic to your app. 

```ts title="index.ts"
export interface Env {
	AI: Ai;
}

export default {
	async fetch(request: Request, env: Env) {
		return env.AI.gateway("default").run({
			provider: "compat",
			endpoint: "chat/completions",
			headers: {
				authorization: "Bearer ",
			},
			query: {
				model: "google-ai-studio/gemini-2.0-flash",
				messages: [
					{
						role: "user",
						content: "What is Cloudflare?",
					},
				],
			},
		});
	},
};
```

## Supported Providers

The OpenAI-compatible endpoint supports models from the following providers:

- [Anthropic](/ai-gateway/providers/anthropic/)
- [OpenAI](/ai-gateway/providers/openai/)
- [Groq](/ai-gateway/providers/groq/)
- [Mistral](/ai-gateway/providers/mistral/)
- [Cohere](/ai-gateway/providers/cohere/)
- [Perplexity](/ai-gateway/providers/perplexity/)
- [Workers AI](/ai-gateway/providers/workersai/)
- [Google-AI-Studio](/ai-gateway/providers/google-ai-studio/)
- [Grok](/ai-gateway/providers/grok/)
- [DeepSeek](/ai-gateway/providers/deepseek/)
- [Cerebras](/ai-gateway/providers/cerebras/)

---

# Architectures

URL: https://developers.cloudflare.com/ai-gateway/demos/

import { GlossaryTooltip, ResourcesBySelector } from "~/components";

Learn how you can use AI Gateway within your existing architecture.

## Reference architectures

Explore the following <GlossaryTooltip term="reference architecture">reference architectures</GlossaryTooltip> that use AI Gateway:

<ResourcesBySelector
	types={[
		"reference-architecture",
		"design-guide",
		"reference-architecture-diagram",
	]}
	products={["AI Gateway"]}
/>

---

# Getting started

URL: https://developers.cloudflare.com/ai-gateway/get-started/

import { Details, DirectoryListing, LinkButton, Render } from "~/components";

In this guide, you will learn how to create your first AI Gateway. You can create multiple gateways to control different applications.

## Prerequisites

Before you get started, you need a Cloudflare account.

<LinkButton variant="primary" href="https://dash.cloudflare.com/sign-up">
	Sign up
</LinkButton>

## Create gateway

Then, create a new AI Gateway.

<Render file="create-gateway" />

## Choosing gateway authentication

When setting up a new gateway, you can choose between an authenticated and unauthenticated gateway. Enabling an authenticated gateway requires each request to include a valid authorization token, adding an extra layer of security. We recommend using an authenticated gateway when storing logs to prevent unauthorized access and protect against invalid requests that can inflate log storage usage and make it harder to find the data you need. Learn more about setting up an [Authenticated Gateway](/ai-gateway/configuration/authentication/).

## Connect application

Next, connect your AI provider to your gateway.

AI Gateway offers multiple endpoints for each Gateway you create - one endpoint per provider, and one Universal Endpoint. To use AI Gateway, you will need to create your own account with each provider and provide your API key. AI Gateway acts as a proxy for these requests, enabling observability, caching, and more.

Additionally, AI Gateway has a [WebSockets API](/ai-gateway/websockets-api/) which provides a single persistent connection, enabling continuous communication. This API supports all AI providers connected to AI Gateway, including those that do not natively support WebSockets.

Below is a list of our supported model providers:

<DirectoryListing folder="ai-gateway/providers" />

If you do not have a provider preference, start with one of our dedicated tutorials:

- [OpenAI](/ai-gateway/tutorials/deploy-aig-worker/)
- [Workers AI](/ai-gateway/tutorials/create-first-aig-workers/)

## View analytics

Now that your provider is connected to the AI Gateway, you can view analytics for requests going through your gateway.

<Render file="analytics-overview" /> <br />

<Render file="analytics-dashboard" />

:::note[Note]

The cost metric is an estimation based on the number of tokens sent and received in requests. While this metric can help you monitor and predict cost trends, refer to your provider's dashboard for the most accurate cost details.

:::

## Next steps

- Learn more about [caching](/ai-gateway/configuration/caching/) for faster requests and cost savings and [rate limiting](/ai-gateway/configuration/rate-limiting/) to control how your application scales.
- Explore how to specify model or provider [fallbacks](/ai-gateway/configuration/fallbacks/) for resiliency.
- Learn how to use low-cost, open source models on [Workers AI](/ai-gateway/providers/workersai/) - our AI inference service.

---

# Header Glossary

URL: https://developers.cloudflare.com/ai-gateway/glossary/

import { Glossary } from "~/components";

AI Gateway supports a variety of headers to help you configure, customize, and manage your API requests. This page provides a complete list of all supported headers, along with a short description

<Glossary product="ai-gateway" />

## Configuration hierarchy

Settings in AI Gateway can be configured at three levels: **Provider**, **Request**, and **Gateway**. Since the same settings can be configured in multiple locations, the following hierarchy determines which value is applied:

1. **Provider-level headers**:
   Relevant only when using the [Universal Endpoint](/ai-gateway/universal/), these headers take precedence over all other configurations.
2. **Request-level headers**:
   Apply if no provider-level headers are set.
3. **Gateway-level settings**:
   Act as the default if no headers are set at the provider or request levels.

This hierarchy ensures consistent behavior, prioritizing the most specific configurations. Use provider-level and request-level headers for more fine-tuned control, and gateway settings for general defaults.

---

# Cloudflare AI Gateway

URL: https://developers.cloudflare.com/ai-gateway/

import {
	CardGrid,
	Description,
	Feature,
	LinkTitleCard,
	Plan,
	RelatedProduct,
} from "~/components";

<Description>

Observe and control your AI applications.

</Description>

<Plan type="all" />

Cloudflare's AI Gateway allows you to gain visibility and control over your AI apps. By connecting your apps to AI Gateway, you can gather insights on how people are using your application with analytics and logging and then control how your application scales with features such as caching, rate limiting, as well as request retries, model fallback, and more. Better yet - it only takes one line of code to get started.

Check out the [Get started guide](/ai-gateway/get-started/) to learn how to configure your applications with AI Gateway.

## Features

<Feature header="Analytics" href="/ai-gateway/observability/analytics/" cta="View Analytics">

View metrics such as the number of requests, tokens, and the cost it takes to run your application.

</Feature>

<Feature header="Logging" href="/ai-gateway/observability/logging/" cta="View Logging">

Gain insight on requests and errors.

</Feature>

<Feature header="Caching" href="/ai-gateway/configuration/caching/">

Serve requests directly from Cloudflare's cache instead of the original model provider for faster requests and cost savings.

</Feature>

<Feature header="Rate limiting" href="/ai-gateway/configuration/rate-limiting">

Control how your application scales by limiting the number of requests your application receives.

</Feature>

<Feature header="Request retry and fallback" href="/ai-gateway/configuration/fallbacks/">

Improve resilience by defining request retry and model fallbacks in case of an error.

</Feature>

<Feature header="Your favorite providers" href="/ai-gateway/providers/">

Workers AI, OpenAI, Azure OpenAI, HuggingFace, Replicate, and more work with AI Gateway.

</Feature>

---

## Related products

<RelatedProduct header="Workers AI" href="/workers-ai/" product="workers-ai">

Run machine learning models, powered by serverless GPUs, on Cloudflare’s global network.

</RelatedProduct>

<RelatedProduct header="Vectorize" href="/vectorize/" product="vectorize">

Build full-stack AI applications with Vectorize, Cloudflare's vector database. Adding Vectorize enables you to perform tasks such as semantic search, recommendations, anomaly detection or can be used to provide context and memory to an LLM.

</RelatedProduct>

## More resources

<CardGrid>

<LinkTitleCard
	title="Developer Discord"
	href="https://discord.cloudflare.com"
	icon="discord"
>
	Connect with the Workers community on Discord to ask questions, show what you
	are building, and discuss the platform with other developers.
</LinkTitleCard>

<LinkTitleCard title="Use cases" href="/use-cases/ai/" icon="document">
	Learn how you can build and deploy ambitious AI applications to Cloudflare's
	global network.
</LinkTitleCard>

<LinkTitleCard
	title="@CloudflareDev"
	href="https://x.com/cloudflaredev"
	icon="x.com"
>
	Follow @CloudflareDev on Twitter to learn about product announcements, and
	what is new in Cloudflare Workers.
</LinkTitleCard>

</CardGrid>

---

# Universal Endpoint

URL: https://developers.cloudflare.com/ai-gateway/universal/

import { Render, Badge } from "~/components";

You can use the Universal Endpoint to contact every provider.

```txt
https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}
```

AI Gateway offers multiple endpoints for each Gateway you create - one endpoint per provider, and one Universal Endpoint. The Universal Endpoint requires some adjusting to your schema, but supports additional features. Some of these features are, for example, retrying a request if it fails the first time, or configuring a [fallback model/provider](/ai-gateway/configuration/fallbacks/).

You can use the Universal endpoint to contact every provider. The payload is expecting an array of message, and each message is an object with the following parameters:

- `provider` : the name of the provider you would like to direct this message to. Can be OpenAI, workers-ai, or any of our supported providers.
- `endpoint`: the pathname of the provider API you’re trying to reach. For example, on OpenAI it can be `chat/completions`, and for Workers AI this might be [`@cf/meta/llama-3.1-8b-instruct`](/workers-ai/models/llama-3.1-8b-instruct/). See more in the sections that are specific to [each provider](/ai-gateway/providers/).
- `authorization`: the content of the Authorization HTTP Header that should be used when contacting this provider. This usually starts with 'Token' or 'Bearer'.
- `query`: the payload as the provider expects it in their official API.

## cURL example

<Render file="universal-gateway-example" />

The above will send a request to Workers AI Inference API, if it fails it will proceed to OpenAI. You can add as many fallbacks as you need, just by adding another JSON in the array.

## WebSockets API <Badge text="beta" variant="tip" size="small" />

The Universal Endpoint can also be accessed via a [WebSockets API](/ai-gateway/websockets-api/) which provides a single persistent connection, enabling continuous communication. This API supports all AI providers connected to AI Gateway, including those that do not natively support WebSockets.

## WebSockets example

```javascript
import WebSocket from "ws";
const ws = new WebSocket(
	"wss://gateway.ai.cloudflare.com/v1/my-account-id/my-gateway/",
	{
		headers: {
			"cf-aig-authorization": "Bearer AI_GATEWAY_TOKEN",
		},
	},
);

ws.send(
	JSON.stringify({
		type: "universal.create",
		request: {
			eventId: "my-request",
			provider: "workers-ai",
			endpoint: "@cf/meta/llama-3.1-8b-instruct",
			headers: {
				Authorization: "Bearer WORKERS_AI_TOKEN",
				"Content-Type": "application/json",
			},
			query: {
				prompt: "tell me a joke",
			},
		},
	}),
);

ws.on("message", function incoming(message) {
	console.log(message.toString());
});
```

## Workers Binding example

import { WranglerConfig } from "~/components";

<WranglerConfig>

```toml title="wrangler.toml"
[ai]
binding = "AI"
```

</WranglerConfig>

```typescript title="src/index.ts"
type Env = {
	AI: Ai;
};

export default {
	async fetch(request: Request, env: Env) {
		return env.AI.gateway('my-gateway').run({
			provider: "workers-ai",
			endpoint: "@cf/meta/llama-3.1-8b-instruct",
			headers: {
				authorization: "Bearer my-api-token",
			},
			query: {
				prompt: "tell me a joke",
			},
		});
	},
};
```

## Header configuration hierarchy

The Universal Endpoint allows you to set fallback models or providers and customize headers for each provider or request. You can configure headers at three levels:

1. **Provider level**: Headers specific to a particular provider.
2. **Request level**: Headers included in individual requests.
3. **Gateway settings**: Default headers configured in your gateway dashboard.

Since the same settings can be configured in multiple locations, AI Gateway applies a hierarchy to determine which configuration takes precedence:

- **Provider-level headers** override all other configurations.
- **Request-level headers** are used if no provider-level headers are set.
- **Gateway-level settings** are used only if no headers are configured at the provider or request levels.

This hierarchy ensures consistent behavior, prioritizing the most specific configurations. Use provider-level and request-level headers for fine-tuned control, and gateway settings for general defaults.

## Hierarchy example

This example demonstrates how headers set at different levels impact caching behavior:

- **Request-level header**: The `cf-aig-cache-ttl` is set to `3600` seconds, applying this caching duration to the request by default.
- **Provider-level header**: For the fallback provider (OpenAI), `cf-aig-cache-ttl` is explicitly set to `0` seconds, overriding the request-level header and disabling caching for responses when OpenAI is used as the provider.

This shows how provider-level headers take precedence over request-level headers, allowing for granular control of caching behavior.

```bash
curl https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id} \
  --header 'Content-Type: application/json' \
  --header 'cf-aig-cache-ttl: 3600' \
  --data '[
    {
      "provider": "workers-ai",
      "endpoint": "@cf/meta/llama-3.1-8b-instruct",
      "headers": {
        "Authorization": "Bearer {cloudflare_token}",
        "Content-Type": "application/json"
      },
      "query": {
        "messages": [
          {
            "role": "system",
            "content": "You are a friendly assistant"
          },
          {
            "role": "user",
            "content": "What is Cloudflare?"
          }
        ]
      }
    },
    {
      "provider": "openai",
      "endpoint": "chat/completions",
      "headers": {
        "Authorization": "Bearer {open_ai_token}",
        "Content-Type": "application/json",
        "cf-aig-cache-ttl": "0"
      },
      "query": {
        "model": "gpt-4o-mini",
        "stream": true,
        "messages": [
          {
            "role": "user",
            "content": "What is Cloudflare?"
          }
        ]
      }
    }
  ]'
```

---

# Authentication

URL: https://developers.cloudflare.com/ai-gateway/configuration/authentication/

Using an Authenticated Gateway in AI Gateway adds security by requiring a valid authorization token for each request. This feature is especially useful when storing logs, as it prevents unauthorized access and protects against invalid requests that can inflate log storage usage and make it harder to find the data you need. With Authenticated Gateway enabled, only requests with the correct token are processed.

:::note
We recommend enabling Authenticated Gateway when opting to store logs with AI Gateway.

If Authenticated Gateway is enabled but a request does not include the required `cf-aig-authorization` header, the request will fail. This setting ensures that only verified requests pass through the gateway. To bypass the need for the `cf-aig-authorization` header, make sure to disable Authenticated Gateway.
:::

## Setting up Authenticated Gateway using the Dashboard

1. Go to the Settings for the specific gateway you want to enable authentication for.
2. Select **Create authentication token** to generate a custom token with the required `Run` permissions. Be sure to securely save this token, as it will not be displayed again.
3. Include the `cf-aig-authorization` header with your API token in each request for this gateway.
4. Return to the settings page and toggle on Authenticated Gateway.

## Example requests with OpenAI

```bash
curl https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/openai/chat/completions \
  --header 'cf-aig-authorization: Bearer {CF_AIG_TOKEN}' \
  --header 'Authorization: Bearer OPENAI_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{"model": "gpt-3.5-turbo", "messages": [{"role": "user", "content": "What is Cloudflare?"}]}'
```

Using the OpenAI SDK:

```javascript
import OpenAI from "openai";

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
	baseURL: "https://gateway.ai.cloudflare.com/v1/account-id/gateway/openai",
	defaultHeaders: {
		"cf-aig-authorization": `Bearer {token}`,
	},
});
```

## Example requests with the Vercel AI SDK

```javascript
import { createOpenAI } from "@ai-sdk/openai";

const openai = createOpenAI({
	baseURL: "https://gateway.ai.cloudflare.com/v1/account-id/gateway/openai",
	headers: {
		"cf-aig-authorization": `Bearer {token}`,
	},
});
```

## Expected behavior

The following table outlines gateway behavior based on the authentication settings and header status:

| Authentication Setting | Header Info    | Gateway State           | Response                                   |
| ---------------------- | -------------- | ----------------------- | ------------------------------------------ |
| On                     | Header present | Authenticated gateway   | Request succeeds                           |
| On                     | No header      | Error                   | Request fails due to missing authorization |
| Off                    | Header present | Unauthenticated gateway | Request succeeds                           |
| Off                    | No header      | Unauthenticated gateway | Request succeeds                           |

---

# Caching

URL: https://developers.cloudflare.com/ai-gateway/configuration/caching/

import { TabItem, Tabs } from "~/components";

AI Gateway can cache responses from your AI model providers, serving them directly from Cloudflare's cache for identical requests.

## Benefits of Using Caching

- **Reduced Latency:** Serve responses faster to your users by avoiding a round trip to the origin AI provider for repeated requests.
- **Cost Savings:** Minimize the number of paid requests made to your AI provider, especially for frequently accessed or non-dynamic content.
- **Increased Throughput:** Offload repetitive requests from your AI provider, allowing it to handle unique requests more efficiently.

:::note

Currently caching is supported only for text and image responses, and it applies only to identical requests.

This configuration benefits use cases with limited prompt options. For example, a support bot that asks "How can I help you?" and lets the user select an answer from a limited set of options works well with the current caching configuration.
We plan on adding semantic search for caching in the future to improve cache hit rates.
:::

## Default configuration

<Tabs syncKey="dashPlusAPI"> <TabItem label="Dashboard">

To set the default caching configuration in the dashboard:

1. Log into the [Cloudflare dashboard](https://dash.cloudflare.com/) and select your account.
2. Select **AI** > **AI Gateway**.
3. Select **Settings**.
4. Enable **Cache Responses**.
5. Change the default caching to whatever value you prefer.

</TabItem> <TabItem label="API">

To set the default caching configuration using the API:

1. [Create an API token](/fundamentals/api/get-started/create-token/) with the following permissions:

- `AI Gateway - Read`
- `AI Gateway - Edit`

2. Get your [Account ID](/fundamentals/account/find-account-and-zone-ids/).
3. Using that API token and Account ID, send a [`POST` request](/api/resources/ai_gateway/methods/create/) to create a new Gateway and include a value for the `cache_ttl`.

</TabItem> </Tabs>

This caching behavior will be uniformly applied to all requests that support caching. If you need to modify the cache settings for specific requests, you have the flexibility to override this setting on a per-request basis.

To check whether a response comes from cache or not, **cf-aig-cache-status** will be designated as `HIT` or `MISS`.

## Per-request caching

While your gateway's default cache settings provide a good baseline, you might need more granular control. These situations could be data freshness, content with varying lifespans, or dynamic or personalized responses.

To address these needs, AI Gateway allows you to override default cache behaviors on a per-request basis using specific HTTP headers. This gives you the precision to optimize caching for individual API calls.

The following headers allow you to define this per-request cache behavior:

:::note

The following headers have been updated to new names, though the old headers will still function. We recommend updating to the new headers to ensure future compatibility:

`cf-cache-ttl` is now `cf-aig-cache-ttl`

`cf-skip-cache` is now `cf-aig-skip-cache`

:::

### Skip cache (cf-aig-skip-cache)

Skip cache refers to bypassing the cache and fetching the request directly from the original provider, without utilizing any cached copy.

You can use the header **cf-aig-skip-cache** to bypass the cached version of the request.

As an example, when submitting a request to OpenAI, include the header in the following manner:

```bash title="Request skipping the cache"
curl https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/openai/chat/completions \
  --header "Authorization: Bearer $TOKEN" \
  --header 'Content-Type: application/json' \
  --header 'cf-aig-skip-cache: true' \
  --data ' {
   		 "model": "gpt-4o-mini",
   		 "messages": [
   			 {
   				 "role": "user",
   				 "content": "how to build a wooden spoon in 3 short steps? give as short as answer as possible"
   			 }
   		 ]
   	 }
'
```

### Cache TTL (cf-aig-cache-ttl)

Cache TTL, or Time To Live, is the duration a cached request remains valid before it expires and is refreshed from the original source. You can use **cf-aig-cache-ttl** to set the desired caching duration in seconds. The minimum TTL is 60 seconds and the maximum TTL is one month.

For example, if you set a TTL of one hour, it means that a request is kept in the cache for an hour. Within that hour, an identical request will be served from the cache instead of the original API. After an hour, the cache expires and the request will go to the original API for a fresh response, and that response will repopulate the cache for the next hour.

As an example, when submitting a request to OpenAI, include the header in the following manner:

```bash title="Request to be cached for an hour"
curl https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/openai/chat/completions \
  --header "Authorization: Bearer $TOKEN" \
  --header 'Content-Type: application/json' \
  --header 'cf-aig-cache-ttl: 3600' \
  --data ' {
   		 "model": "gpt-4o-mini",
   		 "messages": [
   			 {
   				 "role": "user",
   				 "content": "how to build a wooden spoon in 3 short steps? give as short as answer as possible"
   			 }
   		 ]
   	 }
'
```

### Custom cache key (cf-aig-cache-key)

Custom cache keys let you override the default cache key in order to precisely set the cacheability setting for any resource. To override the default cache key, you can use the header **cf-aig-cache-key**.

When you use the **cf-aig-cache-key** header for the first time, you will receive a response from the provider. Subsequent requests with the same header will return the cached response. If the **cf-aig-cache-ttl** header is used, responses will be cached according to the specified Cache Time To Live. Otherwise, responses will be cached according to the cache settings in the dashboard. If caching is not enabled for the gateway, responses will be cached for 5 minutes by default.

As an example, when submitting a request to OpenAI, include the header in the following manner:

```bash title="Request with custom cache key"
curl https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/openai/chat/completions \
  --header 'Authorization: Bearer {openai_token}' \
  --header 'Content-Type: application/json' \
  --header 'cf-aig-cache-key: responseA' \
  --data ' {
   		 "model": "gpt-4o-mini",
   		 "messages": [
   			 {
   				 "role": "user",
   				 "content": "how to build a wooden spoon in 3 short steps? give as short as answer as possible"
   			 }
   		 ]
   	 }
'
```

:::caution[AI Gateway caching behavior]
Cache in AI Gateway is volatile. If two identical requests are sent simultaneously, the first request may not cache in time for the second request to use it, which may result in the second request retrieving data from the original source.
:::

---

# Custom costs

URL: https://developers.cloudflare.com/ai-gateway/configuration/custom-costs/

import { TabItem, Tabs } from "~/components";

AI Gateway allows you to set custom costs at the request level. By using this feature, the cost metrics can accurately reflect your unique pricing, overriding the default or public model costs.

:::note[Note]

Custom costs will only apply to requests that pass tokens in their response. Requests without token information will not have costs calculated.

:::

## Custom cost

To add custom costs to your API requests, use the `cf-aig-custom-cost` header. This header enables you to specify the cost per token for both input (tokens sent) and output (tokens received).

- **per_token_in**: The negotiated input token cost (per token).
- **per_token_out**: The negotiated output token cost (per token).

There is no limit to the number of decimal places you can include, ensuring precise cost calculations, regardless of how small the values are.

Custom costs will appear in the logs with an underline, making it easy to identify when custom pricing has been applied.

In this example, if you have a negotiated price of $1 per million input tokens and $2 per million output tokens, include the `cf-aig-custom-cost` header as shown below.

```bash title="Request with custom cost"
curl https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/openai/chat/completions \
  --header "Authorization: Bearer $TOKEN" \
  --header 'Content-Type: application/json' \
  --header 'cf-aig-custom-cost: {"per_token_in":0.000001,"per_token_out":0.000002}' \
  --data ' {
        "model": "gpt-4o-mini",
        "messages": [
          {
            "role": "user",
            "content": "When is Cloudflare’s Birthday Week?"
          }
        ]
      }'
```

:::note

If a response is served from cache (cache hit), the cost is always `0`, even if you specified a custom cost. Custom costs only apply when the request reaches the model provider.
:::

---

# Custom metadata

URL: https://developers.cloudflare.com/ai-gateway/configuration/custom-metadata/

Custom metadata in AI Gateway allows you to tag requests with user IDs or other identifiers, enabling better tracking and analysis of your requests. Metadata values can be strings, numbers, or booleans, and will appear in your logs, making it easy to search and filter through your data.

## Key Features

* **Custom Tagging**: Add user IDs, team names, test indicators, and other relevant information to your requests.
* **Enhanced Logging**: Metadata appears in your logs, allowing for detailed inspection and troubleshooting.
* **Search and Filter**: Use metadata to efficiently search and filter through logged requests.

:::note


AI Gateway allows you to pass up to five custom metadata entries per request. If more than five entries are provided, only the first five will be saved; additional entries will be ignored. Ensure your custom metadata is limited to five entries to avoid unprocessed or lost data.

:::

## Supported Metadata Types

* String
* Number
* Boolean

:::note


Objects are not supported as metadata values.


:::

## Implementations

### Using cURL

To include custom metadata in your request using cURL:

```bash
curl https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/openai/chat/completions \
  --header 'Authorization: Bearer {api_token}' \
  --header 'Content-Type: application/json' \
  --header 'cf-aig-metadata: {"team": "AI", "user": 12345, "test":true}' \
  --data '{"model": "gpt-4o", "messages": [{"role": "user", "content": "What should I eat for lunch?"}]}'
```

### Using SDK

To include custom metadata in your request using the OpenAI SDK:

```javascript
import OpenAI from "openai";

export default {
 async fetch(request, env, ctx) {
   const openai = new OpenAI({
     apiKey: env.OPENAI_API_KEY,
     baseURL: "https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/openai",
   });

   try {
     const chatCompletion = await openai.chat.completions.create(
       {
         model: "gpt-4o",
         messages: [{ role: "user", content: "What should I eat for lunch?" }],
         max_tokens: 50,
       },
       {
         headers: {
           "cf-aig-metadata": JSON.stringify({
             user: "JaneDoe",
             team: 12345,
             test: true
           }),
         },
       }
     );

     const response = chatCompletion.choices[0].message;
     return new Response(JSON.stringify(response));
   } catch (e) {
     console.log(e);
     return new Response(e);
   }
 },
};
```

### Using Binding

To include custom metadata in your request using [Bindings](/workers/runtime-apis/bindings/):

```javascript
export default {
 async fetch(request, env, ctx) {
   const aiResp = await env.AI.run(
       '@cf/mistral/mistral-7b-instruct-v0.1',
       { prompt: 'What should I eat for lunch?' },
       { gateway: { id: 'gateway_id', metadata: { "team": "AI", "user": 12345, "test": true} } }
   );

   return new Response(aiResp);
 },
};
```

---

# Fallbacks

URL: https://developers.cloudflare.com/ai-gateway/configuration/fallbacks/

import { Render } from "~/components";

Specify model or provider fallbacks with your [Universal endpoint](/ai-gateway/universal/) to handle request failures and ensure reliability.

Cloudflare can trigger your fallback provider in response to [request errors](#request-failures) or [predetermined request timeouts](/ai-gateway/configuration/request-handling#request-timeouts). The [response header `cf-aig-step`](#response-headercf-aig-step) indicates which step successfully processed the request.

## Request failures

By default, Cloudflare triggers your fallback if a model request returns an error.

### Example

In the following example, a request first goes to the [Workers AI](/workers-ai/) Inference API. If the request fails, it falls back to OpenAI. The response header `cf-aig-step` indicates which provider successfully processed the request.

1. Sends a request to Workers AI Inference API.
2. If that request fails, proceeds to OpenAI.

```mermaid
graph TD
    A[AI Gateway] --> B[Request to Workers AI Inference API]
    B -->|Success| C[Return Response]
    B -->|Failure| D[Request to OpenAI API]
    D --> E[Return Response]
```

<br />

You can add as many fallbacks as you need, just by adding another object in the array.

<Render file="universal-gateway-example" />

## Response header(cf-aig-step)

When using the [Universal endpoint](/ai-gateway/universal/) with fallbacks, the response header `cf-aig-step` indicates which model successfully processed the request by returning the step number. This header provides visibility into whether a fallback was triggered and which model ultimately processed the response.

- `cf-aig-step:0` – The first (primary) model was used successfully.
- `cf-aig-step:1` – The request fell back to the second model.
- `cf-aig-step:2` – The request fell back to the third model.
- Subsequent steps – Each fallback increments the step number by 1.

---

# Configuration

URL: https://developers.cloudflare.com/ai-gateway/configuration/

import { DirectoryListing } from "~/components";

Configure your AI Gateway with multiple options and customizations.

<DirectoryListing />

---

# Rate limiting

URL: https://developers.cloudflare.com/ai-gateway/configuration/rate-limiting/

import { TabItem, Tabs } from "~/components";

Rate limiting controls the traffic that reaches your application, which prevents expensive bills and suspicious activity.

## Parameters

You can define rate limits as the number of requests that get sent in a specific time frame. For example, you can limit your application to 100 requests per 60 seconds.

You can also select if you would like a **fixed** or **sliding** rate limiting technique. With rate limiting, we allow a certain number of requests within a window of time. For example, if it is a fixed rate, the window is based on time, so there would be no more than `x` requests in a ten minute window. If it is a sliding rate, there would be no more than `x` requests in the last ten minutes.

To illustrate this, let us say you had a limit of ten requests per ten minutes, starting at 12:00. So the fixed window is 12:00-12:10, 12:10-12:20, and so on. If you sent ten requests at 12:09 and ten requests at 12:11, all 20 requests would be successful in a fixed window strategy. However, they would fail in a sliding window strategy since there were more than ten requests in the last ten minutes.

## Handling rate limits

When your requests exceed the allowed rate, you'll encounter rate limiting. This means the server will respond with a `429 Too Many Requests` status code and your request won't be processed. 

## Default configuration

<Tabs syncKey="dashPlusAPI"> <TabItem label="Dashboard">

To set the default rate limiting configuration in the dashboard:

1. Log into the [Cloudflare dashboard](https://dash.cloudflare.com/) and select your account.
2. Go to **AI** > **AI Gateway**.
3. Go to **Settings**.
4. Enable **Rate-limiting**.
5. Adjust the rate, time period, and rate limiting method as desired.

</TabItem> <TabItem label="API">

To set the default rate limiting configuration using the API:

1. [Create an API token](/fundamentals/api/get-started/create-token/) with the following permissions:

- `AI Gateway - Read`
- `AI Gateway - Edit`

2. Get your [Account ID](/fundamentals/account/find-account-and-zone-ids/).
3. Using that API token and Account ID, send a [`POST` request](/api/resources/ai_gateway/methods/create/) to create a new Gateway and include a value for the `rate_limiting_interval`, `rate_limiting_limit`, and `rate_limiting_technique`.

</TabItem> </Tabs>

This rate limiting behavior will be uniformly applied to all requests for that gateway.

---

# Manage gateways

URL: https://developers.cloudflare.com/ai-gateway/configuration/manage-gateway/

import { Render } from "~/components"

You have several different options for managing an AI Gateway.

## Create gateway

<Render file="create-gateway" />

## Edit gateway

<Render file="edit-gateway" />

:::note


For more details about what settings are available for editing, refer to [Configuration](/ai-gateway/configuration/).


:::

## Delete gateway

Deleting your gateway is permanent and can not be undone.

<Render file="delete-gateway" />

---

# Request handling

URL: https://developers.cloudflare.com/ai-gateway/configuration/request-handling/

import { Render, Aside } from "~/components";

Your AI gateway supports different strategies for handling requests to providers, which allows you to manage AI interactions effectively and ensure your applications remain responsive and reliable.

## Request timeouts

A request timeout allows you to trigger fallbacks or a retry if a provider takes too long to respond.

These timeouts help:

- Improve user experience, by preventing users from waiting too long for a response
- Proactively handle errors, by detecting unresponsive providers and triggering a fallback option

Request timeouts can be set on a Universal Endpoint or directly on a request to any provider.

### Definitions

A timeout is set in milliseconds. Additionally, the timeout is based on when the first part of the response comes back. As long as the first part of the response returns within the specified timeframe - such as when streaming a response - your gateway will wait for the response.

### Configuration

#### Universal Endpoint

If set on a [Universal Endpoint](/ai-gateway/universal/), a request timeout specifies the timeout duration for requests and triggers a fallback.

For a Universal Endpoint, configure the timeout value by setting a `requestTimeout` property within the provider-specific `config` object. Each provider can have a different `requestTimeout` value for granular customization.

```bash title="Provider-level config" {11-13} collapse={15-48}
curl 'https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}' \
	--header 'Content-Type: application/json' \
	--data '[
    {
        "provider": "workers-ai",
        "endpoint": "@cf/meta/llama-3.1-8b-instruct",
        "headers": {
            "Authorization": "Bearer {cloudflare_token}",
            "Content-Type": "application/json"
        },
        "config": {
            "requestTimeout": 1000
        },
        "query": {
            "messages": [
                {
                    "role": "system",
                    "content": "You are a friendly assistant"
                },
                {
                    "role": "user",
                    "content": "What is Cloudflare?"
                }
            ]
        }
    },
    {
        "provider": "workers-ai",
        "endpoint": "@cf/meta/llama-3.1-8b-instruct-fast",
        "headers": {
            "Authorization": "Bearer {cloudflare_token}",
            "Content-Type": "application/json"
        },
        "query": {
            "messages": [
                {
                    "role": "system",
                    "content": "You are a friendly assistant"
                },
                {
                    "role": "user",
                    "content": "What is Cloudflare?"
                }
            ]
        },
				"config": {
            "requestTimeout": 3000
        },
    }
]'
```

#### Direct provider

If set on a [provider](/ai-gateway/providers/) request, request timeout specifies the timeout duration for a request and - if exceeded - returns an error.

For a provider-specific endpoint, configure the timeout value by adding a `cf-aig-request-timeout` header.

```bash title="Provider-specific endpoint example" {4}
curl https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/workers-ai/@cf/meta/llama-3.1-8b-instruct \
 --header 'Authorization: Bearer {cf_api_token}' \
 --header 'Content-Type: application/json' \
 --header 'cf-aig-request-timeout: 5000'
 --data '{"prompt": "What is Cloudflare?"}'
```

---

## Request retries

AI Gateway also supports automatic retries for failed requests, with a maximum of five retry attempts.

This feature improves your application's resiliency, ensuring you can recover from temporary issues without manual intervention.

Request timeouts can be set on a Universal Endpoint or directly on a request to any provider.

### Definitions

With request retries, you can adjust a combination of three properties:

- Number of attempts (maximum of 5 tries)
- How long before retrying (in milliseconds, maximum of 5 seconds)
- Backoff method (constant, linear, or exponential)

On the final retry attempt, your gateway will wait until the request completes, regardless of how long it takes.

### Configuration

#### Universal endpoint

If set on a [Universal Endpoint](/ai-gateway/universal/), a request retry will automatically retry failed requests up to five times before triggering any configured fallbacks.

For a Universal Endpoint, configure the retry settings with the following properties in the provider-specific `config`:

```json
config:{
	maxAttempts?: number;
	retryDelay?: number;
	backoff?: "constant" | "linear" | "exponential";
}
```

As with the [request timeout](/ai-gateway/configuration/request-handling/#universal-endpoint), each provider can have a different retry settings for granular customization.

```bash title="Provider-level config" {11-15} collapse={16-55}
curl 'https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}' \
	--header 'Content-Type: application/json' \
	--data '[
    {
        "provider": "workers-ai",
        "endpoint": "@cf/meta/llama-3.1-8b-instruct",
        "headers": {
            "Authorization": "Bearer {cloudflare_token}",
            "Content-Type": "application/json"
        },
        "config": {
            "maxAttempts": 2,
						"retryDelay": 1000,
						"backoff": "constant"
        },
        "query": {
            "messages": [
                {
                    "role": "system",
                    "content": "You are a friendly assistant"
                },
                {
                    "role": "user",
                    "content": "What is Cloudflare?"
                }
            ]
        }
    },
    {
        "provider": "workers-ai",
        "endpoint": "@cf/meta/llama-3.1-8b-instruct-fast",
        "headers": {
            "Authorization": "Bearer {cloudflare_token}",
            "Content-Type": "application/json"
        },
        "query": {
            "messages": [
                {
                    "role": "system",
                    "content": "You are a friendly assistant"
                },
                {
                    "role": "user",
                    "content": "What is Cloudflare?"
                }
            ]
        },
				"config": {
            "maxAttempts": 4,
						"retryDelay": 1000,
						"backoff": "exponential"
        },
    }
]'
```

#### Direct provider

If set on a [provider](/ai-gateway/universal/) request, a request retry will automatically retry failed requests up to five times. On the final retry attempt, your gateway will wait until the request completes, regardless of how long it takes.

For a provider-specific endpoint, configure the retry settings by adding different header values:

- `cf-aig-max-attempts` (number)
- `cf-aig-retry-delay` (number)
- `cf-aig-backoff` ("constant" | "linear" | "exponential)

---

# Add Human Feedback using API

URL: https://developers.cloudflare.com/ai-gateway/evaluations/add-human-feedback-api/

This guide will walk you through the steps of adding human feedback to an AI Gateway request using the Cloudflare API. You will learn how to retrieve the relevant request logs, and submit feedback using the API.

If you prefer to add human feedback via the dashboard, refer to [Add Human Feedback](/ai-gateway/evaluations/add-human-feedback/).

## 1. Create an API Token

1. [Create an API token](/fundamentals/api/get-started/create-token/) with the following permissions:

- `AI Gateway - Read`
- `AI Gateway - Edit`

2. Get your [Account ID](/fundamentals/account/find-account-and-zone-ids/).
3. Using that API token and Account ID, send a [`POST` request](/api/resources/ai_gateway/methods/create/) to the Cloudflare API.

## 2. Using the API Token

Once you have the token, you can use it in API requests by adding it to the authorization header as a bearer token. Here is an example of how to use it in a request:

```bash
curl "https://api.cloudflare.com/client/v4/accounts/{account_id}/ai-gateway/gateways/{gateway_id}/logs" \
--header "Authorization: Bearer {your_api_token}"
```

In the request above:

- Replace `{account_id}` and `{gateway_id}` with your specific Cloudflare account and gateway details.
- Replace `{your_api_token}` with the API token you just created.

## 3. Retrieve the `cf-aig-log-id`

The `cf-aig-log-id` is a unique identifier for the specific log entry to which you want to add feedback. Below are two methods to obtain this identifier.

### Method 1: Locate the `cf-aig-log-id` in the request response

This method allows you to directly find the `cf-aig-log-id` within the header of the response returned by the AI Gateway. This is the most straightforward approach if you have access to the original API response.

The steps below outline how to do this.

1. **Make a Request to the AI Gateway**: This could be a request your application sends to the AI Gateway. Once the request is made, the response will contain various pieces of metadata.
2. **Check the Response Headers**: The response will include a header named `cf-aig-log-id`. This is the identifier you will need to submit feedback.

In the example below, the `cf-aig-log-id` is `01JADMCQQQBWH3NXZ5GCRN98DP`.

```json
{
	"status": "success",
	"headers": {
		"cf-aig-log-id": "01JADMCQQQBWH3NXZ5GCRN98DP"
	},
	"data": {
		"response": "Sample response data"
	}
}
```

### Method 2: Retrieve the `cf-aig-log-id` via API (GET request)

If you don't have the `cf-aig-log-id` in the response body or you need to access it after the fact, you can retrieve it by querying the logs using the [Cloudflare API](/api/resources/ai_gateway/subresources/logs/methods/list/).

The steps below outline how to do this.

1. **Send a GET Request to Retrieve Logs**: You can query the AI Gateway logs for a specific time frame or for a specific request. The request will return a list of logs, each containing its own `id`.
   Here is an example request:

```bash
GET https://api.cloudflare.com/client/v4/accounts/{account_id}/ai-gateway/gateways/{gateway_id}/logs
```

Replace `{account_id}` and `{gateway_id}` with your specific account and gateway details.

2. **Search for the Relevant Log**: In the response from the GET request, locate the specific log entry for which you would like to submit feedback. Each log entry will include the `id`.

In the example below, the `id` is `01JADMCQQQBWH3NXZ5GCRN98DP`.

```json
{
	"result": [
		{
			"id": "01JADMCQQQBWH3NXZ5GCRN98DP",
			"cached": true,
			"created_at": "2019-08-24T14:15:22Z",
			"custom_cost": true,
			"duration": 0,
			"id": "string",
			"metadata": "string",
			"model": "string",
			"model_type": "string",
			"path": "string",
			"provider": "string",
			"request_content_type": "string",
			"request_type": "string",
			"response_content_type": "string",
			"status_code": 0,
			"step": 0,
			"success": true,
			"tokens_in": 0,
			"tokens_out": 0
		}
	],
	"result_info": {
		"count": 0,
		"max_cost": 0,
		"max_duration": 0,
		"max_tokens_in": 0,
		"max_tokens_out": 0,
		"max_total_tokens": 0,
		"min_cost": 0,
		"min_duration": 0,
		"min_tokens_in": 0,
		"min_tokens_out": 0,
		"min_total_tokens": 0,
		"page": 0,
		"per_page": 0,
		"total_count": 0
	},
	"success": true
}
```

### Method 3: Retrieve the `cf-aig-log-id` via a binding

You can also retrieve the `cf-aig-log-id` using a binding, which streamlines the process. Here's how to retrieve the log ID directly:

```js
const resp = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
		prompt: 'tell me a joke'
}, {
		gateway: {
				id: 'my_gateway_id'
		}
})

const myLogId = env.AI.aiGatewayLogId
```

:::note[Note:]


The `aiGatewayLogId` property, will only hold the last inference call log id.


:::

## 4. Submit feedback via PATCH request

Once you have both the API token and the `cf-aig-log-id`, you can send a PATCH request to submit feedback. Use the following URL format, replacing the `{account_id}`, `{gateway_id}`, and `{log_id}` with your specific details:

```bash
PATCH https://api.cloudflare.com/client/v4/accounts/{account_id}/ai-gateway/gateways/{gateway_id}/logs/{log_id}
```

Add the following in the request body to submit positive feedback:

```json
{
	"feedback": 1
}
```

Add the following in the request body to submit negative feedback:

```json
{
	"feedback": -1
}
```

## 5. Verify the feedback submission

You can verify the feedback submission in two ways:

- **Through the [Cloudflare dashboard ](https://dash.cloudflare.com)**: check the updated feedback on the AI Gateway interface.
- **Through the API**: Send another GET request to retrieve the updated log entry and confirm the feedback has been recorded.

---

# Add human feedback using Worker Bindings

URL: https://developers.cloudflare.com/ai-gateway/evaluations/add-human-feedback-bindings/

This guide explains how to provide human feedback for AI Gateway evaluations using Worker bindings.

## 1. Run an AI Evaluation

Start by sending a prompt to the AI model through your AI Gateway.

```javascript
const resp = await env.AI.run(
	"@cf/meta/llama-3.1-8b-instruct",
	{
		prompt: "tell me a joke",
	},
	{
		gateway: {
			id: "my-gateway",
		},
	},
);

const myLogId = env.AI.aiGatewayLogId;
```

Let the user interact with or evaluate the AI response. This interaction will inform the feedback you send back to the AI Gateway.

## 2. Send Human Feedback

Use the [`patchLog()`](/ai-gateway/integrations/worker-binding-methods/#31-patchlog-send-feedback) method to provide feedback for the AI evaluation.

```javascript
await env.AI.gateway("my-gateway").patchLog(myLogId, {
	feedback: 1, // all fields are optional; set values that fit your use case
	score: 100,
	metadata: {
		user: "123", // Optional metadata to provide additional context
	},
});
```

## Feedback parameters explanation

- `feedback`: is either `-1` for negative or `1` to positive, `0` is considered not evaluated.
- `score`: A number between 0 and 100.
- `metadata`: An object containing additional contextual information.

### patchLog: Send Feedback

The `patchLog` method allows you to send feedback, score, and metadata for a specific log ID. All object properties are optional, so you can include any combination of the parameters:

```javascript
gateway.patchLog("my-log-id", {
	feedback: 1,
	score: 100,
	metadata: {
		user: "123",
	},
});
```

Returns: `Promise<void>` (Make sure to `await` the request.)

---

# Add Human Feedback using Dashboard

URL: https://developers.cloudflare.com/ai-gateway/evaluations/add-human-feedback/

Human feedback is a valuable metric to assess the performance of your AI models. By incorporating human feedback, you can gain deeper insights into how the model's responses are perceived and how well it performs from a user-centric perspective. This feedback can then be used in evaluations to calculate performance metrics, driving optimization and ultimately enhancing the reliability, accuracy, and efficiency of your AI application.

Human feedback measures the performance of your dataset based on direct human input. The metric is calculated as the percentage of positive feedback (thumbs up) given on logs, which are annotated in the Logs tab of the Cloudflare dashboard. This feedback helps refine model performance by considering real-world evaluations of its output.

This tutorial will guide you through the process of adding human feedback to your evaluations in AI Gateway using the [Cloudflare dashboard](https://dash.cloudflare.com/).

On the next guide, you can [learn how to add human feedback via the API](/ai-gateway/evaluations/add-human-feedback-api/).

## 1. Log in to the dashboard

1. Log into the [Cloudflare dashboard](https://dash.cloudflare.com/) and select your account.
2. Go to **AI** > **AI Gateway**.

## 2. Access the Logs tab

1. Go to **Logs**.
2. The Logs tab displays all logs associated with your datasets. These logs show key information, including:
   - Timestamp: When the interaction occurred.
   - Status: Whether the request was successful, cached, or failed.
   - Model: The model used in the request.
   - Tokens: The number of tokens consumed by the response.
   - Cost: The cost based on token usage.
   - Duration: The time taken to complete the response.
   - Feedback: Where you can provide human feedback on each log.

## 3. Provide human feedback

1. Click on the log entry you want to review. This expands the log, allowing you to see more detailed information.
2. In the expanded log, you can view additional details such as:
   - The user prompt.
   - The model response.
   - HTTP response details.
   - Endpoint information.
3. You will see two icons:
   - Thumbs up: Indicates positive feedback.
   - Thumbs down: Indicates negative feedback.
4. Click either the thumbs up or thumbs down icon based on how you rate the model response for that particular log entry.

## 4. Evaluate human feedback

After providing feedback on your logs, it becomes a part of the evaluation process.

When you run an evaluation (as outlined in the [Set Up Evaluations](/ai-gateway/evaluations/set-up-evaluations/) guide), the human feedback metric will be calculated based on the percentage of logs that received thumbs-up feedback.

:::note[Note]

You need to select human feedback as an evaluator to receive its metrics.

:::

## 5. Review results

After running the evaluation, review the results on the Evaluations tab.
You will be able to see the performance of the model based on cost, speed, and now human feedback, represented as the percentage of positive feedback (thumbs up).

The human feedback score is displayed as a percentage, showing the distribution of positively rated responses from the database.

For more information on running evaluations, refer to the documentation [Set Up Evaluations](/ai-gateway/evaluations/set-up-evaluations/).

---

# Evaluations

URL: https://developers.cloudflare.com/ai-gateway/evaluations/

Understanding your application's performance is essential for optimization. Developers often have different priorities, and finding the optimal solution involves balancing key factors such as cost, latency, and accuracy. Some prioritize low-latency responses, while others focus on accuracy or cost-efficiency.

AI Gateway's Evaluations provide the data needed to make informed decisions on how to optimize your AI application. Whether it is adjusting the model, provider, or prompt, this feature delivers insights into key metrics around performance, speed, and cost. It empowers developers to better understand their application's behavior, ensuring improved accuracy, reliability, and customer satisfaction.

Evaluations use datasets which are collections of logs stored for analysis. You can create datasets by applying filters in the Logs tab, which help narrow down specific logs for evaluation.

Our first step toward comprehensive AI evaluations starts with human feedback (currently in open beta). We will continue to build and expand AI Gateway with additional evaluators.

[Learn how to set up an evaluation](/ai-gateway/evaluations/set-up-evaluations/) including creating datasets, selecting evaluators, and running the evaluation process.

---

# Set up Evaluations

URL: https://developers.cloudflare.com/ai-gateway/evaluations/set-up-evaluations/

This guide walks you through the process of setting up an evaluation in AI Gateway. These steps are done in the [Cloudflare dashboard](https://dash.cloudflare.com/).

## 1. Select or create a dataset

Datasets are collections of logs stored for analysis that can be used in an evaluation. You can create datasets by applying filters in the Logs tab. Datasets will update automatically based on the set filters.

### Set up a dataset from the Logs tab

1. Apply filters to narrow down your logs. Filter options include provider, number of tokens, request status, and more.
2. Select **Create Dataset** to store the filtered logs for future analysis.

You can manage datasets by selecting **Manage datasets** from the Logs tab.

:::note[Note]

Please keep in mind that datasets currently use `AND` joins, so there can only be one item per filter (for example, one model or one provider). Future updates will allow more flexibility in dataset creation.

:::

### List of available filters

| Filter category | Filter options                                               | Filter by description                     |
| --------------- | ------------------------------------------------------------ | ----------------------------------------- |
| Status          | error, status                                                | error type or status.                     |
| Cache           | cached, not cached                                           | based on whether they were cached or not. |
| Provider        | specific providers                                           | the selected AI provider.                 |
| AI Models       | specific models                                              | the selected AI model.                    |
| Cost            | less than, greater than                                      | cost, specifying a threshold.             |
| Request type    | Universal, Workers AI Binding, WebSockets                    | the type of request.                      |
| Tokens          | Total tokens, Tokens In, Tokens Out                          | token count (less than or greater than).  |
| Duration        | less than, greater than                                      | request duration.                         |
| Feedback        | equals, does not equal (thumbs up, thumbs down, no feedback) | feedback type.                            |
| Metadata Key    | equals, does not equal                                       | specific metadata keys.                   |
| Metadata Value  | equals, does not equal                                       | specific metadata values.                 |
| Log ID          | equals, does not equal                                       | a specific Log ID.                        |
| Event ID        | equals, does not equal                                       | a specific Event ID.                      |

## 2. Select evaluators

After creating a dataset, choose the evaluation parameters:

- Cost: Calculates the average cost of inference requests within the dataset (only for requests with [cost data](/ai-gateway/observability/costs/)).
- Speed: Calculates the average duration of inference requests within the dataset.
- Performance:
  - Human feedback: measures performance based on human feedback, calculated by the % of thumbs up on the logs, annotated from the Logs tab.

:::note[Note]

Additional evaluators will be introduced in future updates to expand performance analysis capabilities.

:::

## 3. Name, review, and run the evaluation

1. Create a unique name for your evaluation to reference it in the dashboard.
2. Review the selected dataset and evaluators.
3. Select **Run** to start the process.

## 4. Review and analyze results

Evaluation results will appear in the Evaluations tab. The results show the status of the evaluation (for example, in progress, completed, or error). Metrics for the selected evaluators will be displayed, excluding any logs with missing fields. You will also see the number of logs used to calculate each metric.

While datasets automatically update based on filters, evaluations do not. You will have to create a new evaluation if you want to evaluate new logs.

Use these insights to optimize based on your application's priorities. Based on the results, you may choose to:

- Change the model or [provider](/ai-gateway/providers/)
- Adjust your prompts
- Explore further optimizations, such as setting up [Retrieval Augmented Generation (RAG)](/reference-architecture/diagrams/ai/ai-rag/)

---

# Guardrails

URL: https://developers.cloudflare.com/ai-gateway/guardrails/

import { CardGrid, LinkTitleCard, YouTube } from "~/components";

Guardrails help you deploy AI applications safely by intercepting and evaluating both user prompts and model responses for harmful content. Acting as a proxy between your application and [model providers](/ai-gateway/providers/) (such as OpenAI, Anthropic, DeepSeek, and others), AI Gateway's Guardrails ensure a consistent and secure experience across your entire AI ecosystem.

Guardrails proactively monitor interactions between users and AI models, giving you:

- **Consistent moderation**: Uniform moderation layer that works across models and providers.
- **Enhanced safety and user trust**: Proactively protect users from harmful or inappropriate interactions.
- **Flexibility and control over allowed content**: Specify which categories to monitor and choose between flagging or outright blocking.
- **Auditing and compliance capabilities**: Receive updates on evolving regulatory requirements with logs of user prompts, model responses, and enforced guardrails.

## Video demo

<YouTube id="Its1H0jTxrQ" />

## How Guardrails work

AI Gateway inspects all interactions in real time by evaluating content against predefined safety parameters. Guardrails work by:

1. Intercepting interactions:
   AI Gateway proxies requests and responses, sitting between the user and the AI model.

2. Inspecting content:

   - User prompts: AI Gateway checks prompts against safety parameters (for example, violence, hate, or sexual content). Based on your settings, prompts can be flagged or blocked before reaching the model.
   - Model responses: Once processed, the AI model response is inspected. If hazardous content is detected, it can be flagged or blocked before being delivered to the user.

3. Applying actions:
   Depending on your configuration, flagged content is logged for review, while blocked content is prevented from proceeding.

## Related resource

- [Cloudflare Blog: Keep AI interactions secure and risk-free with Guardrails in AI Gateway](https://blog.cloudflare.com/guardrails-in-ai-gateway/)

---

# Set up Guardrails

URL: https://developers.cloudflare.com/ai-gateway/guardrails/set-up-guardrail/

Add Guardrails to any gateway to start evaluating and potentially modifying responses.

1. Log into the [Cloudflare dashboard](https://dash.cloudflare.com/) and select your account.
2. Go to **AI** > **AI Gateway**.
3. Select a gateway.
4. Go to **Guardrails**.
5. Switch the toggle to **On**.
6. To customize categories, select **Change** > **Configure specific categories**.
7. Update your choices for how Guardrails works on specific prompts or responses (**Flag**, **Ignore**, **Block**).
   - For **Prompts**: Guardrails will evaluate and transform incoming prompts based on your security policies.
   - For **Responses**: Guardrails will inspect the model's responses to ensure they meet your content and formatting guidelines.
8. Select **Save**.

:::note[Usage considerations]
For additional details about how to implement Guardrails, refer to [Usage considerations](/ai-gateway/guardrails/usage-considerations/).
:::

## Viewing Guardrail results in Logs

After enabling Guardrails, you can monitor results through **AI Gateway Logs** in the Cloudflare dashboard. Guardrail logs are marked with a **green shield icon**, and each logged request includes an `eventID`, which links to its corresponding Guardrail evaluation log(s) for easy tracking. Logs are generated for all requests, including those that **pass** Guardrail checks.

## Error handling and blocked requests

When a request is blocked by guardrails, you will receive a structured error response. These indicate whether the issue occurred with the prompt or the model response. Use error codes to differentiate between prompt versus response violations.

- **Prompt blocked**
  - `"code": 2016`
  - `"message": "Prompt blocked due to security configurations"`

- **Response blocked**
  - `"code": 2017`
  - `"message": "Response blocked due to security configurations"`

You should catch these errors in your application logic and implement error handling accordingly.

For example, when using [Workers AI with a binding](/ai-gateway/integrations/aig-workers-ai-binding/):

```js
try {
  const res = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
    prompt: "how to build a gun?"
  }, {
    gateway: {id: 'gateway_id'}
  })
  return Response.json(res)
} catch (e) {
  if ((e as Error).message.includes('2016')) {
    return new Response('Prompt was blocked by guardrails.')
  }
  if ((e as Error).message.includes('2017')) {
    return new Response('Response was blocked by guardrails.')
  }
  return new Response('Unknown AI error')
}

---

# Usage considerations

URL: https://developers.cloudflare.com/ai-gateway/guardrails/usage-considerations/

Guardrails currently uses [Llama Guard 3 8B](https://ai.meta.com/research/publications/llama-guard-llm-based-input-output-safeguard-for-human-ai-conversations/) on [Workers AI](/workers-ai/) to perform content evaluations. The underlying model may be updated in the future, and we will reflect those changes within Guardrails.

Since Guardrails runs on Workers AI, enabling it incurs usage on Workers AI. You can monitor usage through the Workers AI Dashboard.

## Additional considerations

- **Model availability**: If at least one hazard category is set to `block`, but AI Gateway is unable to receive a response from Workers AI, the request will be blocked. Conversely, if a hazard category is set to `flag` and AI Gateway cannot obtain a response from Workers AI, the request will proceed without evaluation. This approach prioritizes availability, allowing requests to continue even when content evaluation is not possible.
- **Latency impact**: Enabling Guardrails adds some latency. Enabling Guardrails introduces additional latency to requests. Typically, evaluations using Llama Guard 3 8B on Workers AI add approximately 500 milliseconds per request. However, larger requests may experience increased latency, though this increase is not linear. Consider this when balancing safety and performance.
- **Handling long content**: When evaluating long prompts or responses, Guardrails automatically segments the content into smaller chunks, processing each through separate Guardrail requests. This approach ensures comprehensive moderation but may result in increased latency for longer inputs.
- **Supported languages**: Llama Guard 3.3 8B supports content safety classification in the following languages: English, French, German, Hindi, Italian, Portuguese, Spanish, and Thai.
- **Streaming support**: Streaming is not supported when using Guardrails.

:::note

Llama Guard is provided as-is without any representations, warranties, or guarantees. Any rules or examples contained in blogs, developer docs, or other reference materials are provided for informational purposes only. You acknowledge and understand that you are responsible for the results and outcomes of your use of AI Gateway.

:::

---

# Analytics

URL: https://developers.cloudflare.com/ai-gateway/observability/analytics/

import { Render, TabItem, Tabs } from "~/components";

Your AI Gateway dashboard shows metrics on requests, tokens, caching, errors, and cost. You can filter these metrics by time.
These analytics help you understand traffic patterns, token consumption, and
potential issues across AI providers. You can
view the following analytics:

- **Requests**: Track the total number of requests processed by AI Gateway.
- **Token Usage**: Analyze token consumption across requests, giving insight into usage patterns.
- **Costs**: Gain visibility into the costs associated with using different AI providers, allowing you to track spending, manage budgets, and optimize resources.
- **Errors**: Monitor the number of errors across the gateway, helping to identify and troubleshoot issues.
- **Cached Responses**: View the percentage of responses served from cache, which can help reduce costs and improve speed.

## View analytics

<Tabs> <TabItem label="Dashboard">

<Render file="analytics-dashboard" />

</TabItem> <TabItem label="graphql">

You can use GraphQL to query your usage data outside of the AI Gateway dashboard. See the example query below. You will need to use your Cloudflare token when making the request, and change `{account_id}` to match your account tag.

```bash title="Request"
curl https://api.cloudflare.com/client/v4/graphql \
  --header 'Authorization: Bearer TOKEN \
  --header 'Content-Type: application/json' \
  --data '{
    "query": "query{\n  viewer {\n	accounts(filter: { accountTag: \"{account_id}\" }) {\n	requests: aiGatewayRequestsAdaptiveGroups(\n    	limit: $limit\n    	filter: { datetimeHour_geq: $start, datetimeHour_leq: $end }\n    	orderBy: [datetimeMinute_ASC]\n  	) {\n    	count,\n    	dimensions {\n        	model,\n        	provider,\n        	gateway,\n        	ts: datetimeMinute\n    	}\n    	\n  	}\n    	\n	}\n  }\n}",
    "variables": {
   	 "limit": 1000,
   	 "start": "2023-09-01T10:00:00.000Z",
   	 "end": "2023-09-30T10:00:00.000Z",
   	 "orderBy": "date_ASC"
    }
}'
```

</TabItem> </Tabs>

---

# Supported model types

URL: https://developers.cloudflare.com/ai-gateway/guardrails/supported-model-types/

AI Gateway's Guardrails detects the type of AI model being used and applies safety checks accordingly:

- **Text generation models**: Both prompts and responses are evaluated.
- **Embedding models**: Only the prompt is evaluated, as the response consists of numerical embeddings, which are not meaningful for moderation.
- **Unknown models**: If the model type cannot be determined, only the prompt is evaluated, while the response bypass Guardrails.

:::note[Note]

Guardrails does not yet support streaming responses. Support for streaming is planned for a future update.

:::

---

# Costs

URL: https://developers.cloudflare.com/ai-gateway/observability/costs/

Cost metrics are only available for endpoints where the models return token data and the model name in their responses.

## Track costs across AI providers

AI Gateway makes it easier to monitor and estimate token based costs across all your AI providers. This can help you:

- Understand and compare usage costs between providers.
- Monitor trends and estimate spend using consistent metrics.
- Apply custom pricing logic to match negotiated rates.

:::note[Note]

The cost metric is an **estimation** based on the number of tokens sent and received in requests. While this metric can help you monitor and predict cost trends, refer to your provider's dashboard for the most **accurate** cost details.

:::

:::caution[Caution]

Providers may introduce new models or change their pricing. If you notice outdated cost data or are using a model not yet supported by our cost tracking, please [submit a request](https://forms.gle/8kRa73wRnvq7bxL48)

:::

## Custom costs

AI Gateway allows users to set custom costs when operating under special pricing agreements or negotiated rates. Custom costs can be applied at the request level, and when applied, they will override the default or public model costs.
For more information on configuration of custom costs, please visit the [Custom Costs](/ai-gateway/configuration/custom-costs/) configuration page.

---

# Observability

URL: https://developers.cloudflare.com/ai-gateway/observability/

import { DirectoryListing } from "~/components";

Observability is the practice of instrumenting systems to collect metrics, and logs enabling better monitoring, troubleshooting, and optimization of applications.

<DirectoryListing />

---

# Workers AI

URL: https://developers.cloudflare.com/ai-gateway/integrations/aig-workers-ai-binding/

import { Render, PackageManagers, WranglerConfig } from "~/components";

This guide will walk you through setting up and deploying a Workers AI project. You will use [Workers](/workers/), an AI Gateway binding, and a large language model (LLM), to deploy your first AI-powered application on the Cloudflare global network.

## Prerequisites

<Render file="prereqs" product="workers" />

## 1. Create a Worker Project

You will create a new Worker project using the create-Cloudflare CLI (C3). C3 is a command-line tool designed to help you set up and deploy new applications to Cloudflare.

Create a new project named `hello-ai` by running:

<PackageManagers type="create" pkg="cloudflare@latest" args={"hello-ai"} />

Running `npm create cloudflare@latest` will prompt you to install the create-cloudflare package and lead you through setup. C3 will also install [Wrangler](/workers/wrangler/), the Cloudflare Developer Platform CLI.

<Render
	file="c3-post-run-steps"
	product="workers"
	params={{
		category: "hello-world",
		type: "Worker only",
		lang: "TypeScript",
	}}
/>

This will create a new `hello-ai` directory. Your new `hello-ai` directory will include:

- A "Hello World" Worker at `src/index.ts`.
- A [Wrangler configuration file](/workers/wrangler/configuration/)

Go to your application directory:

```bash
cd hello-ai
```

## 2. Connect your Worker to Workers AI

You must create an AI binding for your Worker to connect to Workers AI. Bindings allow your Workers to interact with resources, like Workers AI, on the Cloudflare Developer Platform.

To bind Workers AI to your Worker, add the following to the end of your [Wrangler configuration file](/workers/wrangler/configuration/):

<WranglerConfig>

```toml title="wrangler.toml"
[ai]
binding = "AI"
```

</WranglerConfig>

Your binding is [available in your Worker code](/workers/reference/migrate-to-module-workers/#bindings-in-es-modules-format) on [`env.AI`](/workers/runtime-apis/handlers/fetch/).

You will need to have your `gateway id` for the next step. You can learn [how to create an AI Gateway in this tutorial](/ai-gateway/get-started/).

## 3. Run an inference task containing AI Gateway in your Worker

You are now ready to run an inference task in your Worker. In this case, you will use an LLM, [`llama-3.1-8b-instruct-fast`](/workers-ai/models/llama-3.1-8b-instruct-fast/), to answer a question. Your gateway ID is found on the dashboard.

Update the `index.ts` file in your `hello-ai` application directory with the following code:

```typescript title="src/index.ts" {78-81}
export interface Env {
	// If you set another name in the [Wrangler configuration file](/workers/wrangler/configuration/) as the value for 'binding',
	// replace "AI" with the variable name you defined.
	AI: Ai;
}

export default {
	async fetch(request, env): Promise<Response> {
		// Specify the gateway label and other options here
		const response = await env.AI.run(
			"@cf/meta/llama-3.1-8b-instruct-fast",
			{
				prompt: "What is the origin of the phrase Hello, World",
			},
			{
				gateway: {
					id: "GATEWAYID", // Use your gateway label here
					skipCache: true, // Optional: Skip cache if needed
				},
			},
		);

		// Return the AI response as a JSON object
		return new Response(JSON.stringify(response), {
			headers: { "Content-Type": "application/json" },
		});
	},
} satisfies ExportedHandler<Env>;
```

Up to this point, you have created an AI binding for your Worker and configured your Worker to be able to execute the Llama 3.1 model. You can now test your project locally before you deploy globally.

## 4. Develop locally with Wrangler

While in your project directory, test Workers AI locally by running [`wrangler dev`](/workers/wrangler/commands/#dev):

```bash
npx wrangler dev
```

<Render file="ai-local-usage-charges" product="workers" />

You will be prompted to log in after you run `wrangler dev`. When you run `npx wrangler dev`, Wrangler will give you a URL (most likely `localhost:8787`) to review your Worker. After you go to the URL Wrangler provides, you will see a message that resembles the following example:

````json
{
  "response": "A fascinating question!\n\nThe phrase \"Hello, World!\" originates from a simple computer program written in the early days of programming. It is often attributed to Brian Kernighan, a Canadian computer scientist and a pioneer in the field of computer programming.\n\nIn the early 1970s, Kernighan, along with his colleague Dennis Ritchie, were working on the C programming language. They wanted to create a simple program that would output a message to the screen to demonstrate the basic structure of a program. They chose the phrase \"Hello, World!\" because it was a simple and recognizable message that would illustrate how a program could print text to the screen.\n\nThe exact code was written in the 5th edition of Kernighan and Ritchie's book \"The C Programming Language,\" published in 1988. The code, literally known as \"Hello, World!\" is as follows:\n\n```
main()
{
  printf(\"Hello, World!\");
}
```\n\nThis code is still often used as a starting point for learning programming languages, as it demonstrates how to output a simple message to the console.\n\nThe phrase \"Hello, World!\" has since become a catch-all phrase to indicate the start of a new program or a small test program, and is widely used in computer science and programming education.\n\nSincerely, I'm glad I could help clarify the origin of this iconic phrase for you!"
}
````

## 5. Deploy your AI Worker

Before deploying your AI Worker globally, log in with your Cloudflare account by running:

```bash
npx wrangler login
```

You will be directed to a web page asking you to log in to the Cloudflare dashboard. After you have logged in, you will be asked if Wrangler can make changes to your Cloudflare account. Scroll down and select **Allow** to continue.

Finally, deploy your Worker to make your project accessible on the Internet. To deploy your Worker, run:

```bash
npx wrangler deploy
```

Once deployed, your Worker will be available at a URL like:

```bash
https://hello-ai.<YOUR_SUBDOMAIN>.workers.dev
```

Your Worker will be deployed to your custom [`workers.dev`](/workers/configuration/routing/workers-dev/) subdomain. You can now visit the URL to run your AI Worker.

By completing this tutorial, you have created a Worker, connected it to Workers AI through an AI Gateway binding, and successfully ran an inference task using the Llama 3.1 model.

---

# Vercel AI SDK

URL: https://developers.cloudflare.com/ai-gateway/integrations/vercel-ai-sdk/

The [Vercel AI SDK](https://sdk.vercel.ai/) is a TypeScript library for building AI applications. The SDK supports many different AI providers, tools for streaming completions, and more.

To use Cloudflare AI Gateway inside of the AI SDK, you can configure a custom "Gateway URL" for most supported providers. Below are a few examples of how it works.

## Examples

### OpenAI

If you're using the `openai` provider in AI SDK, you can create a customized setup with `createOpenAI`, passing your OpenAI-compatible AI Gateway URL:

```typescript
import { createOpenAI } from "@ai-sdk/openai";

const openai = createOpenAI({
	baseURL: `https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/openai`,
});
```

### Anthropic

If you're using the `anthropic` provider in AI SDK, you can create a customized setup with `createAnthropic`, passing your Anthropic-compatible AI Gateway URL:

```typescript
import { createAnthropic } from "@ai-sdk/anthropic";

const anthropic = createAnthropic({
	baseURL: `https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/anthropic`,
});
```

### Google AI Studio

If you're using the Google AI Studio provider in AI SDK, you need to append `/v1beta` to your Google AI Studio-compatible AI Gateway URL to avoid errors. The `/v1beta` path is required because Google AI Studio's API includes this in its endpoint structure, and the AI SDK sets the model name separately. This ensures compatibility with Google's API versioning.

```typescript
import { createGoogleGenerativeAI } from "@ai-sdk/google";

const google = createGoogleGenerativeAI({
	baseURL: `https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/google-ai-studio/v1beta`,
});
```

### Retrieve `log id` from AI SDK

You can access the AI Gateway `log id` from the response headers when invoking the SDK.

```typescript
const result = await generateText({
	model: anthropic("claude-3-sonnet-20240229"),
	messages: [],
});
console.log(result.response.headers["cf-aig-log-id"]);
```

### Other providers

For other providers that are not listed above, you can follow a similar pattern by creating a custom instance for any AI provider, and passing your AI Gateway URL. For help finding your provider-specific AI Gateway URL, refer to the [Supported providers page](/ai-gateway/providers).

---

# AI Gateway Binding Methods

URL: https://developers.cloudflare.com/ai-gateway/integrations/worker-binding-methods/

import { Render, PackageManagers } from "~/components";

This guide provides an overview of how to use the latest Cloudflare Workers AI Gateway binding methods. You will learn how to set up an AI Gateway binding, access new methods, and integrate them into your Workers.

## 1. Add an AI Binding to your Worker

To connect your Worker to Workers AI, add the following to your [Wrangler configuration file](/workers/wrangler/configuration/):

import { WranglerConfig } from "~/components";

<WranglerConfig>

```toml title="wrangler.toml"
[ai]
binding = "AI"
```

</WranglerConfig>

This configuration sets up the AI binding accessible in your Worker code as `env.AI`.

<Render file="wrangler-typegen" product="workers" />

## 2. Basic Usage with Workers AI + Gateway

To perform an inference task using Workers AI and an AI Gateway, you can use the following code:

```typescript title="src/index.ts"
const resp = await env.AI.run(
	"@cf/meta/llama-3.1-8b-instruct",
	{
		prompt: "tell me a joke",
	},
	{
		gateway: {
			id: "my-gateway",
		},
	},
);
```

Additionally, you can access the latest request log ID with:

```typescript
const myLogId = env.AI.aiGatewayLogId;
```

## 3. Access the Gateway Binding

You can access your AI Gateway binding using the following code:

```typescript
const gateway = env.AI.gateway("my-gateway");
```

Once you have the gateway instance, you can use the following methods:

### 3.1. `patchLog`: Send Feedback

The `patchLog` method allows you to send feedback, score, and metadata for a specific log ID. All object properties are optional, so you can include any combination of the parameters:

```typescript
gateway.patchLog("my-log-id", {
	feedback: 1,
	score: 100,
	metadata: {
		user: "123",
	},
});
```

- **Returns**: `Promise<void>` (Make sure to `await` the request.)
- **Example Use Case**: Update a log entry with user feedback or additional metadata.

### 3.2. `getLog`: Read Log Details

The `getLog` method retrieves details of a specific log ID. It returns an object of type `Promise<AiGatewayLog>`. If this type is missing, ensure you have run [`wrangler types`](/workers/languages/typescript/#generate-types).

```typescript
const log = await gateway.getLog("my-log-id");
```

- **Returns**: `Promise<AiGatewayLog>`
- **Example Use Case**: Retrieve log information for debugging or analytics.

### 3.3. `getUrl`: Get Gateway URLs

The `getUrl` method allows you to retrieve the base URL for your AI Gateway, optionally specifying a provider to get the provider-specific endpoint.

```typescript
// Get the base gateway URL
const baseUrl = await gateway.getUrl();
// Output: https://gateway.ai.cloudflare.com/v1/my-account-id/my-gateway/

// Get a provider-specific URL
const openaiUrl = await gateway.getUrl("openai");
// Output: https://gateway.ai.cloudflare.com/v1/my-account-id/my-gateway/openai
```

- **Parameters**: Optional `provider` (string or `AIGatewayProviders` enum)
- **Returns**: `Promise<string>`
- **Example Use Case**: Dynamically construct URLs for direct API calls or debugging configurations.

#### SDK Integration Examples

The `getUrl` method is particularly useful for integrating with popular AI SDKs:

**OpenAI SDK:**

```typescript
import OpenAI from "openai";

const openai = new OpenAI({
	apiKey: "my api key", // defaults to process.env["OPENAI_API_KEY"]
	baseURL: await env.AI.gateway("my-gateway").getUrl("openai"),
});
```

**Vercel AI SDK with OpenAI:**

```typescript
import { createOpenAI } from "@ai-sdk/openai";

const openai = createOpenAI({
	baseURL: await env.AI.gateway("my-gateway").getUrl("openai"),
});
```

**Vercel AI SDK with Anthropic:**

```typescript
import { createAnthropic } from "@ai-sdk/anthropic";

const anthropic = createAnthropic({
	baseURL: await env.AI.gateway("my-gateway").getUrl("anthropic"),
});
```

### 3.4. `run`: Universal Requests

The `run` method allows you to execute universal requests. Users can pass either a single universal request object or an array of them. This method supports all AI Gateway providers.

Refer to the [Universal endpoint documentation](/ai-gateway/universal/) for details about the available inputs.

```typescript
const resp = await gateway.run({
	provider: "workers-ai",
	endpoint: "@cf/meta/llama-3.1-8b-instruct",
	headers: {
		authorization: "Bearer my-api-token",
	},
	query: {
		prompt: "tell me a joke",
	},
});
```

- **Returns**: `Promise<Response>`
- **Example Use Case**: Perform a [universal request](/ai-gateway/universal/) to any supported provider.

## Conclusion

With these AI Gateway binding methods, you can now:

- Send feedback and update metadata with `patchLog`.
- Retrieve detailed log information using `getLog`.
- Get gateway URLs for direct API access with `getUrl`, making it easy to integrate with popular AI SDKs.
- Execute universal requests to any AI Gateway provider with `run`.

These methods offer greater flexibility and control over your AI integrations, empowering you to build more sophisticated applications on the Cloudflare Workers platform.

---

# Create your first AI Gateway using Workers AI

URL: https://developers.cloudflare.com/ai-gateway/tutorials/create-first-aig-workers/

import { Render } from "~/components";

This tutorial guides you through creating your first AI Gateway using Workers AI on the Cloudflare dashboard. The intended audience is beginners who are new to AI Gateway and Workers AI. Creating an AI Gateway enables the user to efficiently manage and secure AI requests, allowing them to utilize AI models for tasks such as content generation, data processing, or predictive analysis with enhanced control and performance.

## Sign up and log in

1. **Sign up**: If you do not have a Cloudflare account, [sign up](https://cloudflare.com/sign-up).
2. **Log in**: Access the Cloudflare dashboard by logging in to the [Cloudflare dashboard](https://dash.cloudflare.com/login).

## Create gateway

Then, create a new AI Gateway.

<Render file="create-gateway" />

## Connect Your AI Provider

1. In the AI Gateway section, select the gateway you created.
2. Select **Workers AI** as your provider to set up an endpoint specific to Workers AI.
   You will receive an endpoint URL for sending requests.

## Configure Your Workers AI

1. Go to **AI** > **Workers AI** in the Cloudflare dashboard.
2. Select **Use REST API** and follow the steps to create and copy the API token and Account ID.
3. **Send Requests to Workers AI**: Use the provided API endpoint. For example, you can run a model via the API using a curl command. Replace `{account_id}`, `{gateway_id}` and `{cf_api_token}` with your actual account ID and API token:

   ```bash
   curl https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/workers-ai/@cf/meta/llama-3.1-8b-instruct \
   --header 'Authorization: Bearer {cf_api_token}' \
   --header 'Content-Type: application/json' \
   --data '{"prompt": "What is Cloudflare?"}'
   ```

The expected output would be similar to :

```bash
{"result":{"response":"I'd be happy to explain what Cloudflare is.\n\nCloudflare is a cloud-based service that provides a range of features to help protect and improve the performance, security, and reliability of websites, applications, and other online services. Think of it as a shield for your online presence!\n\nHere are some of the key things Cloudflare does:\n\n1. **Content Delivery Network (CDN)**: Cloudflare has a network of servers all over the world. When you visit a website that uses Cloudflare, your request is sent to the nearest server, which caches a copy of the website's content. This reduces the time it takes for the content to load, making your browsing experience faster.\n2. **DDoS Protection**: Cloudflare protects against Distributed Denial-of-Service (DDoS) attacks. This happens when a website is overwhelmed with traffic from multiple sources to make it unavailable. Cloudflare filters out this traffic, ensuring your site remains accessible.\n3. **Firewall**: Cloudflare acts as an additional layer of security, filtering out malicious traffic and hacking attempts, such as SQL injection or cross-site scripting (XSS) attacks.\n4. **SSL Encryption**: Cloudflare offers free SSL encryption, which secure sensitive information (like passwords, credit card numbers, and browsing data) with an HTTPS connection (the \"S\" stands for Secure).\n5. **Bot Protection**: Cloudflare has an AI-driven system that identifies and blocks bots trying to exploit vulnerabilities or scrape your content.\n6. **Analytics**: Cloudflare provides insights into website traffic, helping you understand your audience and make informed decisions.\n7. **Cybersecurity**: Cloudflare offers advanced security features, such as intrusion protection, DNS filtering, and Web Application Firewall (WAF) protection.\n\nOverall, Cloudflare helps protect against cyber threats, improves website performance, and enhances security for online businesses, bloggers, and individuals who need to establish a strong online presence.\n\nWould you like to know more about a specific aspect of Cloudflare?"},"success":true,"errors":[],"messages":[]}%
```

## View Analytics

Monitor your AI Gateway to view usage metrics.

1. Go to **AI** > **AI Gateway** in the dashboard.
2. Select your gateway to view metrics such as request counts, token usage, caching efficiency, errors, and estimated costs. You can also turn on additional configurations like logging and rate limiting.

## Optional - Next steps

To build more with Workers, refer to [Tutorials](/workers/tutorials/).

If you have any questions, need assistance, or would like to share your project, join the Cloudflare Developer community on [Discord](https://discord.cloudflare.com) to connect with other developers and the Cloudflare team.

---

# Deploy a Worker that connects to OpenAI via AI Gateway

URL: https://developers.cloudflare.com/ai-gateway/tutorials/deploy-aig-worker/

import { Render, PackageManagers } from "~/components";

In this tutorial, you will learn how to deploy a Worker that makes calls to OpenAI through AI Gateway. AI Gateway helps you better observe and control your AI applications with more analytics, caching, rate limiting, and logging.

This tutorial uses the most recent v4 OpenAI node library, an update released in August 2023.

## Before you start

All of the tutorials assume you have already completed the [Get started guide](/workers/get-started/guide/), which gets you set up with a Cloudflare Workers account, [C3](https://github.com/cloudflare/workers-sdk/tree/main/packages/create-cloudflare), and [Wrangler](/workers/wrangler/install-and-update/).

## 1. Create an AI Gateway and OpenAI API key

On the AI Gateway page in the Cloudflare dashboard, create a new AI Gateway by clicking the plus button on the top right. You should be able to name the gateway as well as the endpoint. Click on the API Endpoints button to copy the endpoint. You can choose from provider-specific endpoints such as OpenAI, HuggingFace, and Replicate. Or you can use the universal endpoint that accepts a specific schema and supports model fallback and retries.

For this tutorial, we will be using the OpenAI provider-specific endpoint, so select OpenAI in the dropdown and copy the new endpoint.

You will also need an OpenAI account and API key for this tutorial. If you do not have one, create a new OpenAI account and create an API key to continue with this tutorial. Make sure to store your API key somewhere safe so you can use it later.

## 2. Create a new Worker

Create a Worker project in the command line:

<PackageManagers type="create" pkg="cloudflare@latest" args={"openai-aig"} />

<Render
	file="c3-post-run-steps"
	product="workers"
	params={{
		category: "hello-world",
		type: "Worker only",
		lang: "JavaScript",
	}}
/>

Go to your new open Worker project:

```sh title="Open your new project directory"
cd openai-aig
```

Inside of your new openai-aig directory, find and open the `src/index.js` file. You will configure this file for most of the tutorial.

Initially, your generated `index.js` file should look like this:

```js
export default {
	async fetch(request, env, ctx) {
		return new Response("Hello World!");
	},
};
```

## 3. Configure OpenAI in your Worker

With your Worker project created, we can learn how to make your first request to OpenAI. You will use the OpenAI node library to interact with the OpenAI API. Install the OpenAI node library with `npm`:

<PackageManagers pkg="openai" />

In your `src/index.js` file, add the import for `openai` above `export default`:

```js
import OpenAI from "openai";
```

Within your `fetch` function, set up the configuration and instantiate your `OpenAIApi` client with the AI Gateway endpoint you created:

```js null {5-8}
import OpenAI from "openai";

export default {
	async fetch(request, env, ctx) {
		const openai = new OpenAI({
			apiKey: env.OPENAI_API_KEY,
			baseURL:
				"https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/openai", // paste your AI Gateway endpoint here
		});
	},
};
```

To make this work, you need to use [`wrangler secret put`](/workers/wrangler/commands/#put) to set your `OPENAI_API_KEY`. This will save the API key to your environment so your Worker can access it when deployed. This key is the API key you created earlier in the OpenAI dashboard:

<PackageManagers type="exec" pkg="wrangler" args="secret put OPENAI_API_KEY" />

To make this work in local development, create a new file `.dev.vars` in your Worker project and add this line. Make sure to replace `OPENAI_API_KEY` with your own OpenAI API key:

```txt title="Save your API key locally"
OPENAI_API_KEY = "<YOUR_OPENAI_API_KEY_HERE>"
```

## 4. Make an OpenAI request

Now we can make a request to the OpenAI [Chat Completions API](https://platform.openai.com/docs/guides/gpt/chat-completions-api).

You can specify what model you'd like, the role and prompt, as well as the max number of tokens you want in your total request.

```js null {10-22}
import OpenAI from "openai";

export default {
	async fetch(request, env, ctx) {
		const openai = new OpenAI({
			apiKey: env.OPENAI_API_KEY,
			baseURL:
				"https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/openai",
		});

		try {
			const chatCompletion = await openai.chat.completions.create({
				model: "gpt-4o-mini",
				messages: [{ role: "user", content: "What is a neuron?" }],
				max_tokens: 100,
			});

			const response = chatCompletion.choices[0].message;

			return new Response(JSON.stringify(response));
		} catch (e) {
			return new Response(e);
		}
	},
};
```

## 5. Deploy your Worker application

To deploy your application, run the `npx wrangler deploy` command to deploy your Worker application:

<PackageManagers type="exec" pkg="wrangler" args="deploy" />

You can now preview your Worker at \<YOUR_WORKER>.\<YOUR_SUBDOMAIN>.workers.dev.

## 6. Review your AI Gateway

When you go to AI Gateway in your Cloudflare dashboard, you should see your recent request being logged. You can also [tweak your settings](/ai-gateway/configuration/) to manage your logs, caching, and rate limiting settings.

---

# Tutorials

URL: https://developers.cloudflare.com/ai-gateway/tutorials/

import { GlossaryTooltip, ListTutorials, YouTubeVideos } from "~/components";

View <GlossaryTooltip term="tutorial">tutorials</GlossaryTooltip> to help you get started with AI Gateway.

## Docs

<ListTutorials />

## Videos

<YouTubeVideos products={["AI Gateway"]} />

---

# Audit logs

URL: https://developers.cloudflare.com/ai-gateway/reference/audit-logs/

[Audit logs](/fundamentals/account/account-security/review-audit-logs/) provide a comprehensive summary of changes made within your Cloudflare account, including those made to gateways in AI Gateway. This functionality is available on all plan types, free of charge, and is enabled by default.

## Viewing Audit Logs

To view audit logs for AI Gateway:

1. Log in to the [Cloudflare dashboard](https://dash.cloudflare.com/login) and select your account.
2. Go to **Manage Account** > **Audit Log**.

For more information on how to access and use audit logs, refer to [review audit logs documentation](/fundamentals/account/account-security/review-audit-logs/).

## Logged Operations

The following configuration actions are logged:

| Operation       | Description                      |
| --------------- | -------------------------------- |
| gateway created | Creation of a new gateway.       |
| gateway deleted | Deletion of an existing gateway. |
| gateway updated | Edit of an existing gateway.     |

## Example Log Entry

Below is an example of an audit log entry showing the creation of a new gateway:

```json
{
 "action": {
     "info": "gateway created",
     "result": true,
     "type": "create"
 },
 "actor": {
     "email": "<ACTOR_EMAIL>",
     "id": "3f7b730e625b975bc1231234cfbec091",
     "ip": "fe32:43ed:12b5:526::1d2:13",
     "type": "user"
 },
 "id": "5eaeb6be-1234-406a-87ab-1971adc1234c",
 "interface": "UI",
 "metadata": {},
 "newValue": "",
 "newValueJson": {
     "cache_invalidate_on_update": false,
     "cache_ttl": 0,
     "collect_logs": true,
     "id": "test",
     "rate_limiting_interval": 0,
     "rate_limiting_limit": 0,
     "rate_limiting_technique": "fixed"
 },
 "oldValue": "",
 "oldValueJson": {},
 "owner": {
     "id": "1234d848c0b9e484dfc37ec392b5fa8a"
 },
 "resource": {
     "id": "89303df8-1234-4cfa-a0f8-0bd848e831ca",
     "type": "ai_gateway.gateway"
 },
 "when": "2024-07-17T14:06:11.425Z"
}
```

---

# Platform

URL: https://developers.cloudflare.com/ai-gateway/reference/

import { DirectoryListing } from "~/components";

<DirectoryListing />

---

# Limits

URL: https://developers.cloudflare.com/ai-gateway/reference/limits/

import { Render } from "~/components";

The following limits apply to gateway configurations, logs, and related features in Cloudflare's platform.

| Feature                                                          | Limit                               |
| ---------------------------------------------------------------- | ----------------------------------- |
| [Cacheable request size](/ai-gateway/configuration/caching/)     | 25 MB per request                   |
| [Cache TTL](/ai-gateway/configuration/caching/#cache-ttl-cf-aig-cache-ttl)     | 1 month               |
| [Custom metadata](/ai-gateway/configuration/custom-metadata/)    | 5 entries per request               |
| [Datasets](/ai-gateway/evaluations/set-up-evaluations/)          | 10 per gateway                      |
| Gateways free plan                                               | 10 per account                      |
| Gateways paid plan                                               | 20 per account                      |
| Gateway name length                                              | 64 characters                       |
| Log storage rate limit                                           | 500 logs per second per gateway     |
| Logs stored [paid plan](/ai-gateway/reference/pricing/)          | 10 million per gateway <sup>1</sup> |
| Logs stored [free plan](/ai-gateway/reference/pricing/)          | 100,000 per account <sup>2</sup>    |
| [Log size stored](/ai-gateway/observability/logging/)            | 10 MB per log <sup>3</sup>          |
| [Logpush jobs](/ai-gateway/observability/logging/logpush/)       | 4 per account                       |
| [Logpush size limit](/ai-gateway/observability/logging/logpush/) | 1MB per log                         |

<sup>1</sup> If you have reached 10 million logs stored per gateway, new logs
will stop being saved. To continue saving logs, you must delete older logs in
that gateway to free up space or create a new gateway. Refer to [Auto Log
Cleanup](/ai-gateway/observability/logging/#auto-log-cleanup) for more details
on how to automatically delete logs.

<sup>2</sup> If you have reached 100,000 logs stored per account, across all
gateways, new logs will stop being saved. To continue saving logs, you must
delete older logs. Refer to [Auto Log
Cleanup](/ai-gateway/observability/logging/#auto-log-cleanup) for more details
on how to automatically delete logs.

<sup>3</sup> Logs larger than 10 MB will not be stored.

<Render file="limits-increase" product="ai-gateway" />

---

# Pricing

URL: https://developers.cloudflare.com/ai-gateway/reference/pricing/

AI Gateway is available to use on all plans.

AI Gateway's core features available today are offered for free, and all it takes is a Cloudflare account and one line of code to [get started](/ai-gateway/get-started/). Core features include: dashboard analytics, caching, and rate limiting.

We will continue to build and expand AI Gateway. Some new features may be additional core features that will be free while others may be part of a premium plan. We will announce these as they become available.

You can monitor your usage in the AI Gateway dashboard.

## Persistent logs

:::note[Note]

Billing for persistent logs has not yet started. Users on paid plans can store logs beyond the included volume of 200,000 logs stored a month without being charged during this period. (Users on the free plan remain limited to the 100,000 logs cap for their plan.) We will provide plenty of advanced notice before charging begins for persistent log storage.

:::

Persistent logs are available on all plans, with a free allocation for both free and paid plans. Charges for additional logs beyond those limits are based on the number of logs stored per month.

### Free allocation and overage pricing

| Plan         | Free logs stored   | Overage pricing                      |
| ------------ | ------------------ | ------------------------------------ |
| Workers Free | 100,000 logs total | N/A - Upgrade to Workers Paid        |
| Workers Paid | 200,000 logs total | $8 per 100,000 logs stored per month |

Allocations are based on the total logs stored across all gateways. For guidance on managing or deleting logs, please see our [documentation](/ai-gateway/observability/logging).

For example, if you are a Workers Paid plan user storing 300,000 logs, you will be charged for the excess 100,000 logs (300,000 total logs - 200,000 free logs), resulting in an $8/month charge.

## Logpush

Logpush is only available on the Workers Paid plan.

|          | Paid plan                          |
| -------- | ---------------------------------- |
| Requests | 10 million / month, +$0.05/million |

## Fine print

Prices subject to change. If you are an Enterprise customer, reach out to your account team to confirm pricing details.

---

# Anthropic

URL: https://developers.cloudflare.com/ai-gateway/providers/anthropic/

import { Render } from "~/components";

[Anthropic](https://www.anthropic.com/) helps build reliable, interpretable, and steerable AI systems.

## Endpoint

```txt
https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/anthropic
```

## Prerequisites

When making requests to Anthropic, ensure you have the following:

- Your AI Gateway Account ID.
- Your AI Gateway gateway name.
- An active Anthropic API token.
- The name of the Anthropic model you want to use.

## Examples

### cURL

```bash title="Example fetch request"
curl https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/anthropic/v1/messages \
 --header 'x-api-key: {anthropic_api_key}' \
 --header 'anthropic-version: 2023-06-01' \
 --header 'Content-Type: application/json' \
 --data  '{
    "model": "claude-3-opus-20240229",
    "max_tokens": 1024,
    "messages": [
      {"role": "user", "content": "What is Cloudflare?"}
    ]
  }'
```

### Use Anthropic SDK with JavaScript

If you are using the `@anthropic-ai/sdk`, you can set your endpoint like this:

```js title="JavaScript"
import Anthropic from "@anthropic-ai/sdk";

const apiKey = env.ANTHROPIC_API_KEY;
const accountId = "{account_id}";
const gatewayId = "{gateway_id}";
const baseURL = `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}/anthropic`;

const anthropic = new Anthropic({
	apiKey,
	baseURL,
});

const model = "claude-3-opus-20240229";
const messages = [{ role: "user", content: "What is Cloudflare?" }];
const maxTokens = 1024;

const message = await anthropic.messages.create({
	model,
	messages,
	max_tokens: maxTokens,
});
```

<Render
	file="chat-completions-providers"
	product="ai-gateway"
	params={{
		name: "Anthropic",
		jsonexample: `
{
	"model": "anthropic/{model}"
}`

    }}

/>

---

# Azure OpenAI

URL: https://developers.cloudflare.com/ai-gateway/providers/azureopenai/

[Azure OpenAI](https://azure.microsoft.com/en-gb/products/ai-services/openai-service/) allows you apply natural language algorithms on your data.

## Endpoint

```txt
https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/azure-openai/{resource_name}/{deployment_name}
```

## Prerequisites

When making requests to Azure OpenAI, you will need:

- AI Gateway account ID
- AI Gateway gateway name
- Azure OpenAI API key
- Azure OpenAI resource name
- Azure OpenAI deployment name (aka model name)

## URL structure

Your new base URL will use the data above in this structure: `https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/azure-openai/{resource_name}/{deployment_name}`. Then, you can append your endpoint and api-version at the end of the base URL, like `.../chat/completions?api-version=2023-05-15`.

## Examples

### cURL

```bash title="Example fetch request"
curl 'https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/azure-openai/{resource_name}/{deployment_name}/chat/completions?api-version=2023-05-15' \
  --header 'Content-Type: application/json' \
  --header 'api-key: {azure_api_key}' \
  --data '{
  "messages": [
    {
      "role": "user",
      "content": "What is Cloudflare?"
    }
  ]
}'
```

### Use `openai-node` with JavaScript

If you are using the `openai-node` library, you can set your endpoint like this:

```js title="JavaScript"
import OpenAI from "openai";

const resource = "xxx";
const model = "xxx";
const apiVersion = "xxx";
const apiKey = env.AZURE_OPENAI_API_KEY;
const accountId = "{account_id}";
const gatewayId = "{gateway_id}";
const baseURL = `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}/azure-openai/${resource}/${model}`;

const azure_openai = new OpenAI({
	apiKey,
	baseURL,
	defaultQuery: { "api-version": apiVersion },
	defaultHeaders: { "api-key": apiKey },
});
```

---

# Cerebras

URL: https://developers.cloudflare.com/ai-gateway/providers/cerebras/

import { Render } from "~/components";

[Cerebras](https://inference-docs.cerebras.ai/) offers developers a low-latency solution for AI model inference.

## Endpoint

```txt
https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/cerebras-ai
```

## Prerequisites

When making requests to Cerebras, ensure you have the following:

- Your AI Gateway Account ID.
- Your AI Gateway gateway name.
- An active Cerebras API token.
- The name of the Cerebras model you want to use.

## Examples

### cURL

```bash title="Example fetch request"
curl https://gateway.ai.cloudflare.com/v1/ACCOUNT_TAG/GATEWAY/cerebras/chat/completions \
 --header 'content-type: application/json' \
 --header 'Authorization: Bearer CEREBRAS_TOKEN' \
 --data '{
    "model": "llama3.1-8b",
    "messages": [
        {
            "role": "user",
            "content": "What is Cloudflare?"
        }
    ]
}'
```

<Render
	file="chat-completions-providers"
	product="ai-gateway"
	params={{
		name: "Cerebras",
		jsonexample: `
{
	"model": "cerebras/{model}"
}`

    }}

/>

---

# Amazon Bedrock

URL: https://developers.cloudflare.com/ai-gateway/providers/bedrock/

[Amazon Bedrock](https://aws.amazon.com/bedrock/) allows you to build and scale generative AI applications with foundation models.

## Endpoint

```txt
https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/aws-bedrock`
```

## Prerequisites

When making requests to Amazon Bedrock, ensure you have the following:

- Your AI Gateway Account ID.
- Your AI Gateway gateway name.
- An active Amazon Bedrock API token.
- The name of the Amazon Bedrock model you want to use.

## Make a request

When making requests to Amazon Bedrock, replace `https://bedrock-runtime.us-east-1.amazonaws.com/` in the URL you're currently using with `https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/aws-bedrock/bedrock-runtime/us-east-1/`, then add the model you want to run at the end of the URL.

With Bedrock, you will need to sign the URL before you make requests to AI Gateway. You can try using the [`aws4fetch`](https://github.com/mhart/aws4fetch) SDK.

## Examples

### Use `aws4fetch` SDK with TypeScript

```typescript
import { AwsClient } from "aws4fetch";

interface Env {
	accessKey: string;
	secretAccessKey: string;
}

export default {
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext,
	): Promise<Response> {
		// replace with your configuration
		const cfAccountId = "{account_id}";
		const gatewayName = "{gateway_id}";
		const region = "us-east-1";

		// added as secrets (https://developers.cloudflare.com/workers/configuration/secrets/)
		const accessKey = env.accessKey;
		const secretKey = env.secretAccessKey;

		const awsClient = new AwsClient({
			accessKeyId: accessKey,
			secretAccessKey: secretKey,
			region: region,
			service: "bedrock",
		});

		const requestBodyString = JSON.stringify({
			inputText: "What does ethereal mean?",
		});

		const stockUrl = new URL(
			`https://bedrock-runtime.${region}.amazonaws.com/model/amazon.titan-embed-text-v1/invoke`,
		);

		const headers = {
			"Content-Type": "application/json",
		};

		// sign the original request
		const presignedRequest = await awsClient.sign(stockUrl.toString(), {
			method: "POST",
			headers: headers,
			body: requestBodyString,
		});

		// Gateway Url
    const gatewayUrl = new URL(`https://gateway.ai.cloudflare.com/v1/${cfAccountId}/${gatewayName}/aws-bedrock/bedrock-runtime/${region}/model/amazon.titan-embed-text-v1/invoke`);

		// make the request through the gateway url
		const response = await fetch(gatewayUrl, {
			method: "POST",
			headers: presignedRequest.headers,
			body: requestBodyString,
		});

		if (
			response.ok &&
			response.headers.get("content-type")?.includes("application/json")
		) {
			const data = await response.json();
			return new Response(JSON.stringify(data));
		}

		return new Response("Invalid response", { status: 500 });
	},
};
```

---

# Cartesia

URL: https://developers.cloudflare.com/ai-gateway/providers/cartesia/

[Cartesia](https://docs.cartesia.ai/) provides advanced text-to-speech services with customizable voice models.

## Endpoint

```txt
https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/cartesia
```

## URL Structure

When making requests to Cartesia, replace `https://api.cartesia.ai/v1` in the URL you are currently using with `https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/cartesia`.

## Prerequisites

When making requests to Cartesia, ensure you have the following:

- Your AI Gateway Account ID.
- Your AI Gateway gateway name.
- An active Cartesia API token.
- The model ID and voice ID for the Cartesia voice model you want to use.

## Example

### cURL

```bash title="Request"
curl https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/cartesia/tts/bytes \
  --header 'Content-Type: application/json' \
  --header 'Cartesia-Version: 2024-06-10' \
  --header 'X-API-Key: {cartesia_api_token}' \
  --data '{
    "transcript": "Welcome to Cloudflare - AI Gateway!",
    "model_id": "sonic-english",
    "voice": {
        "mode": "id",
        "id": "694f9389-aac1-45b6-b726-9d9369183238"
    },
    "output_format": {
        "container": "wav",
        "encoding": "pcm_f32le",
        "sample_rate": 44100
    }
}
```

---

# Cohere

URL: https://developers.cloudflare.com/ai-gateway/providers/cohere/

import { Render } from "~/components";

[Cohere](https://cohere.com/) build AI models designed to solve real-world business challenges.

## Endpoint

```txt
https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/cohere
```

## URL structure

When making requests to [Cohere](https://cohere.com/), replace `https://api.cohere.ai/v1` in the URL you're currently using with `https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/cohere`.

## Prerequisites

When making requests to Cohere, ensure you have the following:

- Your AI Gateway Account ID.
- Your AI Gateway gateway name.
- An active Cohere API token.
- The name of the Cohere model you want to use.

## Examples

### cURL

```bash title="Request"
curl https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/cohere/v1/chat \
  --header 'Authorization: Token {cohere_api_token}' \
  --header 'Content-Type: application/json' \
  --data '{
  "chat_history": [
    {"role": "USER", "message": "Who discovered gravity?"},
    {"role": "CHATBOT", "message": "The man who is widely credited with discovering gravity is Sir Isaac Newton"}
  ],
  "message": "What year was he born?",
  "connectors": [{"id": "web-search"}]
}'
```

### Use Cohere SDK with Python

If using the [`cohere-python-sdk`](https://github.com/cohere-ai/cohere-python), set your endpoint like this:

```js title="Python"

import cohere
import os

api_key = os.getenv('API_KEY')
account_id = '{account_id}'
gateway_id = '{gateway_id}'
base_url = f"https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/cohere/v1"

co = cohere.Client(
  api_key=api_key,
  base_url=base_url,
)

message = "hello world!"
model = "command-r-plus"

chat = co.chat(
  message=message,
  model=model
)

print(chat)

```

<Render
	file="chat-completions-providers"
	product="ai-gateway"
	params={{
		name: "Cohere",
		jsonexample: `
{
	"model": "cohere/{model}"
}`

    }}

/>

---

# DeepSeek

URL: https://developers.cloudflare.com/ai-gateway/providers/deepseek/

import { Render } from "~/components";

[DeepSeek](https://www.deepseek.com/) helps you build quickly with DeepSeek's advanced AI models.

## Endpoint

```txt
https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/deepseek
```

## Prerequisites

When making requests to DeepSeek, ensure you have the following:

- Your AI Gateway Account ID.
- Your AI Gateway gateway name.
- An active DeepSeek AI API token.
- The name of the DeepSeek AI model you want to use.

## URL structure

Your new base URL will use the data above in this structure:

`https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/deepseek/`.

You can then append the endpoint you want to hit, for example: `chat/completions`.

So your final URL will come together as:

`https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/deepseek/chat/completions`.

## Examples

### cURL

```bash title="Example fetch request"
curl https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/deepseek/chat/completions \
 --header 'content-type: application/json' \
 --header 'Authorization: Bearer DEEPSEEK_TOKEN' \
 --data '{
    "model": "deepseek-chat",
    "messages": [
        {
            "role": "user",
            "content": "What is Cloudflare?"
        }
    ]
}'
```

### Use DeepSeek with JavaScript

If you are using the OpenAI SDK, you can set your endpoint like this:

```js title="JavaScript"
import OpenAI from "openai";

const openai = new OpenAI({
	apiKey: env.DEEPSEEK_TOKEN,
	baseURL:
		"https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/deepseek",
});

try {
	const chatCompletion = await openai.chat.completions.create({
		model: "deepseek-chat",
		messages: [{ role: "user", content: "What is Cloudflare?" }],
	});

	const response = chatCompletion.choices[0].message;

	return new Response(JSON.stringify(response));
} catch (e) {
	return new Response(e);
}
```

<Render
	file="chat-completions-providers"
	product="ai-gateway"
	params={{
		name: "DeepSeek",
		jsonexample: `
{
	"model": "deepseek/{model}"
}`

    }}

/>

---

# Google AI Studio

URL: https://developers.cloudflare.com/ai-gateway/providers/google-ai-studio/

import { Render } from "~/components";

[Google AI Studio](https://ai.google.dev/aistudio) helps you build quickly with Google Gemini models.

## Endpoint

```txt
https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/google-ai-studio
```

## Prerequisites

When making requests to Google AI Studio, you will need:

- Your AI Gateway Account ID.
- Your AI Gateway gateway name.
- An active Google AI Studio API token.
- The name of the Google AI Studio model you want to use.

## URL structure

Your new base URL will use the data above in this structure: `https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/google-ai-studio/`.

Then you can append the endpoint you want to hit, for example: `v1/models/{model}:{generative_ai_rest_resource}`

So your final URL will come together as: `https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/google-ai-studio/v1/models/{model}:{generative_ai_rest_resource}`.

## Examples

### cURL

```bash title="Example fetch request"
curl "https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_name}/google-ai-studio/v1/models/gemini-1.0-pro:generateContent" \
 --header 'content-type: application/json' \
 --header 'x-goog-api-key: {google_studio_api_key}' \
 --data '{
      "contents": [
          {
            "role":"user",
            "parts": [
              {"text":"What is Cloudflare?"}
            ]
          }
        ]
      }'
```

### Use `@google/generative-ai` with JavaScript

If you are using the `@google/generative-ai` package, you can set your endpoint like this:

```js title="JavaScript example"
import { GoogleGenerativeAI } from "@google/generative-ai";

const api_token = env.GOOGLE_AI_STUDIO_TOKEN;
const account_id = "";
const gateway_name = "";

const genAI = new GoogleGenerativeAI(api_token);
const model = genAI.getGenerativeModel(
	{ model: "gemini-1.5-flash" },
	{
		baseUrl: `https://gateway.ai.cloudflare.com/v1/${account_id}/${gateway_name}/google-ai-studio`,
	},
);

await model.generateContent(["What is Cloudflare?"]);
```

<Render
	file="chat-completions-providers"
	product="ai-gateway"
	params={{
		name: "Google AI Studio",
		jsonexample: `
{
	"model": "google-ai-studio/{model}"
}`

    }}

/>

---

# ElevenLabs

URL: https://developers.cloudflare.com/ai-gateway/providers/elevenlabs/

[ElevenLabs](https://elevenlabs.io/) offers advanced text-to-speech services, enabling high-quality voice synthesis in multiple languages.

## Endpoint

```txt
https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/elevenlabs
```

## Prerequisites

When making requests to ElevenLabs, ensure you have the following:

- Your AI Gateway Account ID.
- Your AI Gateway gateway name.
- An active ElevenLabs API token.
- The model ID of the ElevenLabs voice model you want to use.

## Example

### cURL

```bash title="Request"
curl https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/elevenlabs/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb?output_format=mp3_44100_128 \
  --header 'Content-Type: application/json' \
  --header 'xi-api-key: {elevenlabs_api_token}' \
  --data '{
    "text": "Welcome to Cloudflare - AI Gateway!",
    "model_id": "eleven_multilingual_v2"
}'
```

---

# Grok

URL: https://developers.cloudflare.com/ai-gateway/providers/grok/

import { Render } from "~/components";

[Grok](https://docs.x.ai/docs#getting-started) is s a general purpose model that can be used for a variety of tasks, including generating and understanding text, code, and function calling.

## Endpoint

```txt
https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/grok
```

## URL structure

When making requests to [Grok](https://docs.x.ai/docs#getting-started), replace `https://api.x.ai/v1` in the URL you are currently using with `https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/grok`.

## Prerequisites

When making requests to Grok, ensure you have the following:

- Your AI Gateway Account ID.
- Your AI Gateway gateway name.
- An active Grok API token.
- The name of the Grok model you want to use.

## Examples

### cURL

```bash title="Request"
curl https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/grok/v1/chat/completions \
  --header 'content-type: application/json' \
  --header 'Authorization: Bearer {grok_api_token}' \
  --data '{
    "model": "grok-beta",
    "messages": [
        {
            "role": "user",
            "content": "What is Cloudflare?"
        }
    ]
}'
```

### Use OpenAI SDK with JavaScript

If you are using the OpenAI SDK with JavaScript, you can set your endpoint like this:

```js title="JavaScript"
import OpenAI from "openai";

const openai = new OpenAI({
	apiKey: "<api key>",
	baseURL:
		"https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/grok",
});

const completion = await openai.chat.completions.create({
	model: "grok-beta",
	messages: [
		{
			role: "system",
			content:
				"You are Grok, a chatbot inspired by the Hitchhiker's Guide to the Galaxy.",
		},
		{
			role: "user",
			content: "What is the meaning of life, the universe, and everything?",
		},
	],
});

console.log(completion.choices[0].message);
```

### Use OpenAI SDK with Python

If you are using the OpenAI SDK with Python, you can set your endpoint like this:

```python title="Python"
import os
from openai import OpenAI

XAI_API_KEY = os.getenv("XAI_API_KEY")
client = OpenAI(
    api_key=XAI_API_KEY,
    base_url="https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/grok",
)

completion = client.chat.completions.create(
    model="grok-beta",
    messages=[
        {"role": "system", "content": "You are Grok, a chatbot inspired by the Hitchhiker's Guide to the Galaxy."},
        {"role": "user", "content": "What is the meaning of life, the universe, and everything?"},
    ],
)

print(completion.choices[0].message)
```

### Use Anthropic SDK with JavaScript

If you are using the Anthropic SDK with JavaScript, you can set your endpoint like this:

```js title="JavaScript"
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
	apiKey: "<api key>",
	baseURL:
		"https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/grok",
});

const msg = await anthropic.messages.create({
	model: "grok-beta",
	max_tokens: 128,
	system:
		"You are Grok, a chatbot inspired by the Hitchhiker's Guide to the Galaxy.",
	messages: [
		{
			role: "user",
			content: "What is the meaning of life, the universe, and everything?",
		},
	],
});

console.log(msg);
```

### Use Anthropic SDK with Python

If you are using the Anthropic SDK with Python, you can set your endpoint like this:

```python title="Python"
import os
from anthropic import Anthropic

XAI_API_KEY = os.getenv("XAI_API_KEY")
client = Anthropic(
    api_key=XAI_API_KEY,
    base_url="https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/grok",
)

message = client.messages.create(
    model="grok-beta",
    max_tokens=128,
    system="You are Grok, a chatbot inspired by the Hitchhiker's Guide to the Galaxy.",
    messages=[
        {
            "role": "user",
            "content": "What is the meaning of life, the universe, and everything?",
        },
    ],
)

print(message.content)
```

<Render
	file="chat-completions-providers"
	product="ai-gateway"
	params={{
		name: "Grok",
		jsonexample: `
{
	"model": "grok/{model}"
}`

    }}

/>

---

# HuggingFace

URL: https://developers.cloudflare.com/ai-gateway/providers/huggingface/

[HuggingFace](https://huggingface.co/) helps users build, deploy and train machine learning models.

## Endpoint

```txt
https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/huggingface
```

## URL structure

When making requests to HuggingFace Inference API, replace `https://api-inference.huggingface.co/models/` in the URL you're currently using with `https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/huggingface`. Note that the model you're trying to access should come right after, for example `https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/huggingface/bigcode/starcoder`.

## Prerequisites

When making requests to HuggingFace, ensure you have the following:

- Your AI Gateway Account ID.
- Your AI Gateway gateway name.
- An active HuggingFace API token.
- The name of the HuggingFace model you want to use.

## Examples

### cURL

```bash title="Request"
curl https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/huggingface/bigcode/starcoder \
  --header 'Authorization: Bearer {hf_api_token}' \
  --header 'Content-Type: application/json' \
  --data '{
    "inputs": "console.log"
}'
```

### Use HuggingFace.js library with JavaScript

If you are using the HuggingFace.js library, you can set your inference endpoint like this:

```js title="JavaScript"
import { HfInferenceEndpoint } from "@huggingface/inference";

const accountId = "{account_id}";
const gatewayId = "{gateway_id}";
const model = "gpt2";
const baseURL = `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}/huggingface/${model}`;
const apiToken = env.HF_API_TOKEN;

const hf = new HfInferenceEndpoint(baseURL, apiToken);
```

---

# Groq

URL: https://developers.cloudflare.com/ai-gateway/providers/groq/

import { Render } from "~/components";

[Groq](https://groq.com/) delivers high-speed processing and low-latency performance.

## Endpoint

```txt
https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/groq
```

## URL structure

When making requests to [Groq](https://groq.com/), replace `https://api.groq.com/openai/v1` in the URL you're currently using with `https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/groq`.

## Prerequisites

When making requests to Groq, ensure you have the following:

- Your AI Gateway Account ID.
- Your AI Gateway gateway name.
- An active Groq API token.
- The name of the Groq model you want to use.

## Examples

### cURL

```bash title="Example fetch request"
curl https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/groq/chat/completions \
  --header 'Authorization: Bearer {groq_api_key}' \
  --header 'Content-Type: application/json' \
  --data '{
    "messages": [
      {
        "role": "user",
        "content": "What is Cloudflare?"
      }
    ],
    "model": "llama3-8b-8192"
}'
```

### Use Groq SDK with JavaScript

If using the [`groq-sdk`](https://www.npmjs.com/package/groq-sdk), set your endpoint like this:

```js title="JavaScript"
import Groq from "groq-sdk";

const apiKey = env.GROQ_API_KEY;
const accountId = "{account_id}";
const gatewayId = "{gateway_id}";
const baseURL = `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}/groq`;

const groq = new Groq({
	apiKey,
	baseURL,
});

const messages = [{ role: "user", content: "What is Cloudflare?" }];
const model = "llama3-8b-8192";

const chatCompletion = await groq.chat.completions.create({
	messages,
	model,
});
```

<Render
	file="chat-completions-providers"
	product="ai-gateway"
	params={{
		name: "Groq",
		jsonexample: `
{
	"model": "groq/{model}"
}`

    }}

/>

---

# Model providers

URL: https://developers.cloudflare.com/ai-gateway/providers/

Here is a quick list of the providers we support:

import { DirectoryListing } from "~/components";

<DirectoryListing />

---

# OpenAI

URL: https://developers.cloudflare.com/ai-gateway/providers/openai/

[OpenAI](https://openai.com/about/) helps you build with ChatGPT.

## Endpoint

```txt
https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/openai
```

### Chat completions endpoint

```txt
https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/openai/chat/completions \
```

### Responses endpoint

```txt
https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/openai/responses \
```

## URL structure

When making requests to OpenAI, replace `https://api.openai.com/v1` in the URL you are currently using with `https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/openai`.

## Prerequisites

When making requests to OpenAI, ensure you have the following:

- Your AI Gateway Account ID.
- Your AI Gateway gateway name.
- An active OpenAI API token.
- The name of the OpenAI model you want to use.

## Chat completions endpoint

### cURL example

```bash
curl https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/openai/chat/completions \
--header 'Authorization: Bearer {openai_token}' \
--header 'Content-Type: application/json' \
--data '{
  "model": "gpt-4o-mini",
  "messages": [
    {
      "role": "user",
      "content": "What is Cloudflare?"
    }
  ]
}'
```

### JavaScript SDK example

```js
import OpenAI from "openai";

const apiKey = "my api key"; // or process.env["OPENAI_API_KEY"]
const accountId = "{account_id}";
const gatewayId = "{gateway_id}";
const baseURL = `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}/openai`;

const openai = new OpenAI({
	apiKey,
	baseURL,
});

try {
	const model = "gpt-3.5-turbo-0613";
	const messages = [{ role: "user", content: "What is a neuron?" }];
	const maxTokens = 100;
	const chatCompletion = await openai.chat.completions.create({
		model,
		messages,
		max_tokens: maxTokens,
	});
	const response = chatCompletion.choices[0].message;
	console.log(response);
} catch (e) {
	console.error(e);
}
```

## OpenAI Responses endpoint

### cURL example

```bash
curl https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/openai/responses \
--header 'Authorization: Bearer {openai_token}' \
--header 'Content-Type: application/json' \
--data '{
  "model": "gpt-4.1",
  "input": [
    {
      "role": "user",
      "content": "Write a one-sentence bedtime story about a unicorn."
    }
  ]
}'
```

### JavaScript SDK example

```js
import OpenAI from "openai";

const apiKey = "my api key"; // or process.env["OPENAI_API_KEY"]
const accountId = "{account_id}";
const gatewayId = "{gateway_id}";
const baseURL = `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}/openai`;

const openai = new OpenAI({
	apiKey,
	baseURL,
});

try {
	const model = "gpt-4.1";
	const input = [
		{
			role: "user",
			content: "Write a one-sentence bedtime story about a unicorn.",
		},
	];
	const response = await openai.responses.create({
		model,
		input,
	});
	console.log(response.output_text);
} catch (e) {
	console.error(e);
}
```

---

# Mistral AI

URL: https://developers.cloudflare.com/ai-gateway/providers/mistral/

import { Render } from "~/components";

[Mistral AI](https://mistral.ai) helps you build quickly with Mistral's advanced AI models.

## Endpoint

```txt
https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/mistral
```

## Prerequisites

When making requests to the Mistral AI, you will need:

- AI Gateway Account ID
- AI Gateway gateway name
- Mistral AI API token
- Mistral AI model name

## URL structure

Your new base URL will use the data above in this structure: `https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/mistral/`.

Then you can append the endpoint you want to hit, for example: `v1/chat/completions`

So your final URL will come together as: `https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/mistral/v1/chat/completions`.

## Examples

### cURL

```bash title="Example fetch request"
curl -X POST https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/mistral/v1/chat/completions \
 --header 'content-type: application/json' \
 --header 'Authorization: Bearer MISTRAL_TOKEN' \
 --data '{
    "model": "mistral-large-latest",
    "messages": [
        {
            "role": "user",
            "content": "What is Cloudflare?"
        }
    ]
}'
```

### Use `@mistralai/mistralai` package with JavaScript

If you are using the `@mistralai/mistralai` package, you can set your endpoint like this:

```js title="JavaScript example"
import { Mistral } from "@mistralai/mistralai";

const client = new Mistral({
	apiKey: MISTRAL_TOKEN,
	serverURL: `https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/mistral`,
});

await client.chat.create({
	model: "mistral-large-latest",
	messages: [
		{
			role: "user",
			content: "What is Cloudflare?",
		},
	],
});
```

<Render
	file="chat-completions-providers"
	product="ai-gateway"
	params={{
		name: "Mistral",
		jsonexample: `
{
	"model": "mistral/{model}"
}`

    }}

/>

---

# Perplexity

URL: https://developers.cloudflare.com/ai-gateway/providers/perplexity/

import { Render } from "~/components";

[Perplexity](https://www.perplexity.ai/) is an AI powered answer engine.

## Endpoint

```txt
https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/perplexity-ai
```

## Prerequisites

When making requests to Perplexity, ensure you have the following:

- Your AI Gateway Account ID.
- Your AI Gateway gateway name.
- An active Perplexity API token.
- The name of the Perplexity model you want to use.

## Examples

### cURL

```bash title="Example fetch request"
curl https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/perplexity-ai/chat/completions \
     --header 'accept: application/json' \
     --header 'content-type: application/json' \
     --header 'Authorization: Bearer {perplexity_token}' \
     --data '{
      "model": "mistral-7b-instruct",
      "messages": [
        {
          "role": "user",
          "content": "What is Cloudflare?"
        }
      ]
    }'
```

### Use Perplexity through OpenAI SDK with JavaScript

Perplexity does not have their own SDK, but they have compatibility with the OpenAI SDK. You can use the OpenAI SDK to make a Perplexity call through AI Gateway as follows:

```js title="JavaScript"
import OpenAI from "openai";

const apiKey = env.PERPLEXITY_API_KEY;
const accountId = "{account_id}";
const gatewayId = "{gateway_id}";
const baseURL = `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}/perplexity-ai`;

const perplexity = new OpenAI({
	apiKey,
	baseURL,
});

const model = "mistral-7b-instruct";
const messages = [{ role: "user", content: "What is Cloudflare?" }];
const maxTokens = 20;

const chatCompletion = await perplexity.chat.completions.create({
	model,
	messages,
	max_tokens: maxTokens,
});
```

<Render
	file="chat-completions-providers"
	product="ai-gateway"
	params={{
		name: "Perplexity",
		jsonexample: `
{
	"model": "perplexity/{model}"
}`

    }}

/>

---

# OpenRouter

URL: https://developers.cloudflare.com/ai-gateway/providers/openrouter/

[OpenRouter](https://openrouter.ai/) is a platform that provides a unified interface for accessing and using large language models (LLMs).

## Endpoint

```txt
https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/openrouter
```

## URL structure

When making requests to [OpenRouter](https://openrouter.ai/), replace `https://openrouter.ai/api/v1/chat/completions` in the URL you are currently using with `https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/openrouter`.

## Prerequisites

When making requests to OpenRouter, ensure you have the following:

- Your AI Gateway Account ID.
- Your AI Gateway gateway name.
- An active OpenRouter API token or a token from the original model provider.
- The name of the OpenRouter model you want to use.

## Examples

### cURL

```bash title="Request"
curl -X POST https://gateway.ai.cloudflare.com/v1/ACCOUNT_TAG/GATEWAY/openrouter/v1/chat/completions \
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

### Use OpenAI SDK with JavaScript

If you are using the OpenAI SDK with JavaScript, you can set your endpoint like this:

```js title="JavaScript"
import OpenAI from "openai";

const openai = new OpenAI({
	apiKey: env.OPENROUTER_TOKEN,
	baseURL:
		"https://gateway.ai.cloudflare.com/v1/ACCOUNT_TAG/GATEWAY/openrouter",
});

try {
	const chatCompletion = await openai.chat.completions.create({
		model: "openai/gpt-3.5-turbo",
		messages: [{ role: "user", content: "What is Cloudflare?" }],
	});

	const response = chatCompletion.choices[0].message;

	return new Response(JSON.stringify(response));
} catch (e) {
	return new Response(e);
}
```

---

# Replicate

URL: https://developers.cloudflare.com/ai-gateway/providers/replicate/

[Replicate](https://replicate.com/) runs and fine tunes open-source models.

## Endpoint

```txt
https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/replicate
```

## URL structure

When making requests to Replicate, replace `https://api.replicate.com/v1` in the URL you're currently using with `https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/replicate`.

## Prerequisites

When making requests to Replicate, ensure you have the following:

- Your AI Gateway Account ID.
- Your AI Gateway gateway name.
- An active Replicate API token.
- The name of the Replicate model you want to use.

## Example

### cURL

```bash title="Request"
curl https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/replicate/predictions \
  --header 'Authorization: Token {replicate_api_token}' \
  --header 'Content-Type: application/json' \
  --data '{
    "input":
      {
        "prompt": "What is Cloudflare?"
      }
    }'
```

---

# Google Vertex AI

URL: https://developers.cloudflare.com/ai-gateway/providers/vertex/

[Google Vertex AI](https://cloud.google.com/vertex-ai) enables developers to easily build and deploy enterprise ready generative AI experiences.

Below is a quick guide on how to set your Google Cloud Account:

1. Google Cloud Platform (GCP) Account

   - Sign up for a [GCP account](https://cloud.google.com/vertex-ai). New users may be eligible for credits (valid for 90 days).

2. Enable the Vertex AI API

   - Navigate to [Enable Vertex AI API](https://console.cloud.google.com/marketplace/product/google/aiplatform.googleapis.com) and activate the API for your project.

3. Apply for access to desired models.

## Endpoint

```txt
https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/google-vertex-ai
```

## Prerequisites

When making requests to Google Vertex, you will need:

- AI Gateway account tag
- AI Gateway gateway name
- Google Vertex API key
- Google Vertex Project Name
- Google Vertex Region (for example, us-east4)
- Google Vertex model

## URL structure

Your new base URL will use the data above in this structure: `https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/google-vertex-ai/v1/projects/{project_name}/locations/{region}`.

Then you can append the endpoint you want to hit, for example: `/publishers/google/models/{model}:{generative_ai_rest_resource}`

So your final URL will come together as: `https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/google-vertex-ai/v1/projects/{project_name}/locations/{region}/publishers/google/models/gemini-1.0-pro-001:generateContent`

## Example

### cURL

```bash title="Example fetch request"
curl "https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/google-vertex-ai/v1/projects/{project_name}/locations/{region}/publishers/google/models/gemini-1.0-pro-001:generateContent" \
    -H "Authorization: Bearer {vertex_api_key}" \
    -H 'Content-Type: application/json' \
    -d '{
        "contents": {
          "role": "user",
          "parts": [
            {
              "text": "Tell me more about Cloudflare"
            }
          ]
        }'

```

---

# Workers AI

URL: https://developers.cloudflare.com/ai-gateway/providers/workersai/

import { Render } from "~/components";

Use AI Gateway for analytics, caching, and security on requests to [Workers AI](/workers-ai/). Workers AI integrates seamlessly with AI Gateway, allowing you to execute AI inference via API requests or through an environment binding for Workers scripts. The binding simplifies the process by routing requests through your AI Gateway with minimal setup.

## Prerequisites

When making requests to Workers AI, ensure you have the following:

- Your AI Gateway Account ID.
- Your AI Gateway gateway name.
- An active Workers AI API token.
- The name of the Workers AI model you want to use.

## REST API

To interact with a REST API, update the URL used for your request:

- **Previous**:

```txt
https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/{model_id}
```

- **New**:

```txt
https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/workers-ai/{model_id}
```

For these parameters:

- `{account_id}` is your Cloudflare [account ID](/workers-ai/get-started/rest-api/#1-get-api-token-and-account-id).
- `{gateway_id}` refers to the name of your existing [AI Gateway](/ai-gateway/get-started/#create-gateway).
- `{model_id}` refers to the model ID of the [Workers AI model](/workers-ai/models/).

## Examples

First, generate an [API token](/fundamentals/api/get-started/create-token/) with `Workers AI Read` access and use it in your request.

```bash title="Request to Workers AI llama model"
curl https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/workers-ai/@cf/meta/llama-3.1-8b-instruct \
 --header 'Authorization: Bearer {cf_api_token}' \
 --header 'Content-Type: application/json' \
 --data '{"prompt": "What is Cloudflare?"}'
```

```bash title="Request to Workers AI text classification model"
curl https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/workers-ai/@cf/huggingface/distilbert-sst-2-int8 \
  --header 'Authorization: Bearer {cf_api_token}' \
  --header 'Content-Type: application/json' \
  --data '{ "text": "Cloudflare docs are amazing!" }'
```

### OpenAI compatible endpoints

<Render file="openai-compatibility" product="workers-ai" /> <br />

```bash title="Request to OpenAI compatible endpoint"
curl https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/workers-ai/v1/chat/completions \
 --header 'Authorization: Bearer {cf_api_token}' \
 --header 'Content-Type: application/json' \
 --data '{
      "model": "@cf/meta/llama-3.1-8b-instruct",
      "messages": [
        {
          "role": "user",
          "content": "What is Cloudflare?"
        }
      ]
    }
'
```

## Workers Binding

You can integrate Workers AI with AI Gateway using an environment binding. To include an AI Gateway within your Worker, add the gateway as an object in your Workers AI request.

```ts
export interface Env {
	AI: Ai;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const response = await env.AI.run(
			"@cf/meta/llama-3.1-8b-instruct",
			{
				prompt: "Why should you use Cloudflare for your AI inference?",
			},
			{
				gateway: {
					id: "{gateway_id}",
					skipCache: false,
					cacheTtl: 3360,
				},
			},
		);
		return new Response(JSON.stringify(response));
	},
} satisfies ExportedHandler<Env>;
```

For a detailed step-by-step guide on integrating Workers AI with AI Gateway using a binding, see [Integrations in AI Gateway](/ai-gateway/integrations/aig-workers-ai-binding/).

Workers AI supports the following parameters for AI gateways:

- `id` string
  - Name of your existing [AI Gateway](/ai-gateway/get-started/#create-gateway). Must be in the same account as your Worker.
- `skipCache` boolean(default: false)
  - Controls whether the request should [skip the cache](/ai-gateway/configuration/caching/#skip-cache-cf-aig-skip-cache).
- `cacheTtl` number
  - Controls the [Cache TTL](/ai-gateway/configuration/caching/#cache-ttl-cf-aig-cache-ttl).

<Render
	file="chat-completions-providers"
	product="ai-gateway"
	params={{
		name: "Workers AI",
		jsonexample: `
{
	"model": "workers-ai/{model}"
}`

    }}

/>

---

# WebSockets API

URL: https://developers.cloudflare.com/ai-gateway/websockets-api/

The AI Gateway WebSockets API provides a persistent connection for AI interactions, eliminating repeated handshakes and reducing latency. This API is divided into two categories:

- **Realtime APIs** - Designed for AI providers that offer low-latency, multimodal interactions over WebSockets.
- **Non-Realtime APIs** - Supports standard WebSocket communication for AI providers, including those that do not natively support WebSockets.

## When to use WebSockets

WebSockets are long-lived TCP connections that enable bi-directional, real-time and non realtime communication between client and server. Unlike HTTP connections, which require repeated handshakes for each request, WebSockets maintain the connection, supporting continuous data exchange with reduced overhead. WebSockets are ideal for applications needing low-latency, real-time data, such as voice assistants.

## Key benefits

- **Reduced overhead**: Avoid overhead of repeated handshakes and TLS negotiations by maintaining a single, persistent connection.
- **Provider compatibility**: Works with all AI providers in AI Gateway. Even if your chosen provider does not support WebSockets, Cloudflare handles it for you, managing the requests to your preferred AI provider.

## Key differences

| Feature                 | Realtime APIs                                                                                                           | Non-Realtime APIs                                                                                |
| :---------------------- | :---------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------- |
| **Purpose**             | Enables real-time, multimodal AI interactions for providers that offer dedicated WebSocket endpoints.                   | Supports WebSocket-based AI interactions with providers that do not natively support WebSockets. |
| **Use Case**            | Streaming responses for voice, video, and live interactions.                                                            | Text-based queries and responses, such as LLM requests.                                          |
| **AI Provider Support** | [Limited to providers offering real-time WebSocket APIs.](/ai-gateway/websockets-api/realtime-api/#supported-providers) | [All AI providers in AI Gateway.](/ai-gateway/providers/)                                        |
| **Streaming Support**   | Providers natively support real-time data streaming.                                                                    | AI Gateway handles streaming via WebSockets.                                                     |

For details on implementation, refer to the next sections:

- [Realtime WebSockets API](/ai-gateway/websockets-api/realtime-api/)
- [Non-Realtime WebSockets API](/ai-gateway/websockets-api/non-realtime-api/)

---

# Non-realtime WebSockets API

URL: https://developers.cloudflare.com/ai-gateway/websockets-api/non-realtime-api/

The Non-realtime WebSockets API allows you to establish persistent connections for AI requests without requiring repeated handshakes. This approach is ideal for applications that do not require real-time interactions but still benefit from reduced latency and continuous communication.

## Set up WebSockets API

1. Generate an AI Gateway token with appropriate AI Gateway Run and opt in to using an authenticated gateway.
2. Modify your Universal Endpoint URL by replacing `https://` with `wss://` to initiate a WebSocket connection:
   ```
   wss://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}
   ```
3. Open a WebSocket connection authenticated with a Cloudflare token with the AI Gateway Run permission.

:::note
Alternatively, we also support authentication via the `sec-websocket-protocol` header if you are using a browser WebSocket.
:::

## Example request

```javascript
import WebSocket from "ws";

const ws = new WebSocket(
	"wss://gateway.ai.cloudflare.com/v1/my-account-id/my-gateway/",
	{
		headers: {
			"cf-aig-authorization": "Bearer AI_GATEWAY_TOKEN",
		},
	},
);

ws.send(
	JSON.stringify({
		type: "universal.create",
		request: {
			eventId: "my-request",
			provider: "workers-ai",
			endpoint: "@cf/meta/llama-3.1-8b-instruct",
			headers: {
				Authorization: "Bearer WORKERS_AI_TOKEN",
				"Content-Type": "application/json",
			},
			query: {
				prompt: "tell me a joke",
			},
		},
	}),
);

ws.on("message", function incoming(message) {
	console.log(message.toString());
});
```

## Example response

```json
{
	"type": "universal.created",
	"metadata": {
		"cacheStatus": "MISS",
		"eventId": "my-request",
		"logId": "01JC3R94FRD97JBCBX3S0ZAXKW",
		"step": "0",
		"contentType": "application/json"
	},
	"response": {
		"result": {
			"response": "Why was the math book sad? Because it had too many problems. Would you like to hear another one?"
		},
		"success": true,
		"errors": [],
		"messages": []
	}
}
```

## Example streaming request

For streaming requests, AI Gateway sends an initial message with request metadata indicating the stream is starting:

```json
{
	"type": "universal.created",
	"metadata": {
		"cacheStatus": "MISS",
		"eventId": "my-request",
		"logId": "01JC40RB3NGBE5XFRZGBN07572",
		"step": "0",
		"contentType": "text/event-stream"
	}
}
```

After this initial message, all streaming chunks are relayed in real-time to the WebSocket connection as they arrive from the inference provider. Only the `eventId` field is included in the metadata for these streaming chunks. The `eventId` allows AI Gateway to include a client-defined ID with each message, even in a streaming WebSocket environment.

```json
{
	"type": "universal.stream",
	"metadata": {
		"eventId": "my-request"
	},
	"response": {
		"response": "would"
	}
}
```

Once all chunks for a request have been streamed, AI Gateway sends a final message to signal the completion of the request. For added flexibility, this message includes all the metadata again, even though it was initially provided at the start of the streaming process.

```json
{
	"type": "universal.done",
	"metadata": {
		"cacheStatus": "MISS",
		"eventId": "my-request",
		"logId": "01JC40RB3NGBE5XFRZGBN07572",
		"step": "0",
		"contentType": "text/event-stream"
	}
}
```

---

# Realtime WebSockets API

URL: https://developers.cloudflare.com/ai-gateway/websockets-api/realtime-api/

Some AI providers support real-time, low-latency interactions over WebSockets. AI Gateway allows seamless integration with these APIs, supporting multimodal interactions such as text, audio, and video.

## Supported Providers

- [OpenAI](https://platform.openai.com/docs/guides/realtime-websocket)
- [Google AI Studio](https://ai.google.dev/gemini-api/docs/multimodal-live)
- [Cartesia](https://docs.cartesia.ai/api-reference/tts/tts)
- [ElevenLabs](https://elevenlabs.io/docs/conversational-ai/api-reference/conversational-ai/websocket)

## Authentication

For real-time WebSockets, authentication can be done using:

- Headers (for non-browser environments)
- `sec-websocket-protocol` (for browsers)

## Examples

### OpenAI

```javascript
import WebSocket from "ws";

const url =
	"wss://gateway.ai.cloudflare.com/v1/<account_id>/<gateway>/openai?model=gpt-4o-realtime-preview-2024-12-17";
const ws = new WebSocket(url, {
	headers: {
		"cf-aig-authorization": process.env.CLOUDFLARE_API_KEY,
		Authorization: "Bearer " + process.env.OPENAI_API_KEY,
		"OpenAI-Beta": "realtime=v1",
	},
});

ws.on("open", () => console.log("Connected to server."));
ws.on("message", (message) => console.log(JSON.parse(message.toString())));

ws.send(
	JSON.stringify({
		type: "response.create",
		response: { modalities: ["text"], instructions: "Tell me a joke" },
	}),
);
```

### Google AI Studio

```javascript
const ws = new WebSocket(
	"wss://gateway.ai.cloudflare.com/v1/<account_id>/<gateway>/google?api_key=<google_api_key>",
	["cf-aig-authorization.<cloudflare_token>"],
);

ws.on("open", () => console.log("Connected to server."));
ws.on("message", (message) => console.log(message.data));

ws.send(
	JSON.stringify({
		setup: {
			model: "models/gemini-2.0-flash-exp",
			generationConfig: { responseModalities: ["TEXT"] },
		},
	}),
);
```

### Cartesia

```javascript
const ws = new WebSocket(
	"wss://gateway.ai.cloudflare.com/v1/<account_id>/<gateway>/cartesia?cartesia_version=2024-06-10&api_key=<cartesia_api_key>",
	["cf-aig-authorization.<cloudflare_token>"],
);

ws.on("open", function open() {
	console.log("Connected to server.");
});

ws.on("message", function incoming(message) {
	console.log(message.data);
});

ws.send(
	JSON.stringify({
		model_id: "sonic",
		transcript: "Hello, world! I'm generating audio on ",
		voice: { mode: "id", id: "a0e99841-438c-4a64-b679-ae501e7d6091" },
		language: "en",
		context_id: "happy-monkeys-fly",
		output_format: {
			container: "raw",
			encoding: "pcm_s16le",
			sample_rate: 8000,
		},
		add_timestamps: true,
		continue: true,
	}),
);
```

### ElevenLabs

```javascript
const ws = new WebSocket(
	"wss://gateway.ai.cloudflare.com/v1/<account_id>/<gateway>/elevenlabs?agent_id=<elevenlabs_agent_id>",
	[
		"xi-api-key.<elevenlabs_api_key>",
		"cf-aig-authorization.<cloudflare_token>",
	],
);

ws.on("open", function open() {
	console.log("Connected to server.");
});

ws.on("message", function incoming(message) {
	console.log(message.data);
});

ws.send(
	JSON.stringify({
		text: "This is a sample text ",
		voice_settings: { stability: 0.8, similarity_boost: 0.8 },
		generation_config: { chunk_length_schedule: [120, 160, 250, 290] },
	}),
);
```

---

# Logging

URL: https://developers.cloudflare.com/ai-gateway/observability/logging/

import { Render } from "~/components";

Logging is a fundamental building block for application development. Logs provide insights during the early stages of development and are often critical to understanding issues occurring in production.

Your AI Gateway dashboard shows logs of individual requests, including the user prompt, model response, provider, timestamp, request status, token usage, cost, and duration. These logs persist, giving you the flexibility to store them for your preferred duration and do more with valuable request data.

By default, each gateway can store up to 10 million logs. You can customize this limit per gateway in your gateway settings to align with your specific requirements. If your storage limit is reached, new logs will stop being saved. To continue saving logs, you must delete older logs to free up space for new logs.
To learn more about your plan limits, refer to [Limits](/ai-gateway/reference/limits/).

We recommend using an authenticated gateway when storing logs to prevent unauthorized access and protects against invalid requests that can inflate log storage usage and make it harder to find the data you need. Learn more about setting up an [authenticated gateway](/ai-gateway/configuration/authentication/).

## Default configuration

Logs, which include metrics as well as request and response data, are enabled by default for each gateway. This logging behavior will be uniformly applied to all requests in the gateway. If you are concerned about privacy or compliance and want to turn log collection off, you can go to settings and opt out of logs. If you need to modify the log settings for specific requests, you can override this setting on a per-request basis.

<Render file="logging" />

## Per-request logging

To override the default logging behavior set in the settings tab, you can define headers on a per-request basis.

### Collect logs (`cf-aig-collect-log`)

The `cf-aig-collect-log` header allows you to bypass the default log setting for the gateway. If the gateway is configured to save logs, the header will exclude the log for that specific request. Conversely, if logging is disabled at the gateway level, this header will save the log for that request.

In the example below, we use `cf-aig-collect-log` to bypass the default setting to avoid saving the log.

```bash
curl https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/openai/chat/completions \
  --header "Authorization: Bearer $TOKEN" \
  --header 'Content-Type: application/json' \
  --header 'cf-aig-collect-log: false \
  --data ' {
        "model": "gpt-4o-mini",
        "messages": [
          {
            "role": "user",
            "content": "What is the email address and phone number of user123?"
          }
        ]
      }
'
```

## Managing log storage

To manage your log storage effectively, you can:
- Set Storage Limits: Configure a limit on the number of logs stored per gateway in your gateway settings to ensure you only pay for what you need.
- Enable Automatic Log Deletion: Activate the Automatic Log Deletion feature in your gateway settings to automatically delete the oldest logs once the log limit you've set or the default storage limit of 10 million logs is reached. This ensures new logs are always saved without manual intervention.

## How to delete logs

To manage your log storage effectively and ensure continuous logging, you can delete logs using the following methods:

### Automatic Log Deletion

​To maintain continuous logging within your gateway's storage constraints, enable Automatic Log Deletion in your Gateway settings. This feature automatically deletes the oldest logs once the log limit you've set or the default storage limit of 10 million logs is reached, ensuring new logs are saved without manual intervention.

### Manual deletion

To manually delete logs through the dashboard, navigate to the Logs tab in the dashboard. Use the available filters such as status, cache, provider, cost, or any other options in the dropdown to refine the logs you wish to delete. Once filtered, select Delete logs to complete the action.

See full list of available filters and their descriptions below:

| Filter category | Filter options                                               | Filter by description                     |
| --------------- | ------------------------------------------------------------ | ----------------------------------------- |
| Status          | error, status                                                | error type or status.                     |
| Cache           | cached, not cached                                           | based on whether they were cached or not. |
| Provider        | specific providers                                           | the selected AI provider.                 |
| AI Models       | specific models                                              | the selected AI model.                    |
| Cost            | less than, greater than                                      | cost, specifying a threshold.             |
| Request type    | Universal, Workers AI Binding, WebSockets                    | the type of request.                      |
| Tokens          | Total tokens, Tokens In, Tokens Out                          | token count (less than or greater than).  |
| Duration        | less than, greater than                                      | request duration.                         |
| Feedback        | equals, does not equal (thumbs up, thumbs down, no feedback) | feedback type.                            |
| Metadata Key    | equals, does not equal                                       | specific metadata keys.                   |
| Metadata Value  | equals, does not equal                                       | specific metadata values.                 |
| Log ID          | equals, does not equal                                       | a specific Log ID.                        |
| Event ID        | equals, does not equal                                       | a specific Event ID.                      |

### API deletion

You can programmatically delete logs using the AI Gateway API. For more comprehensive information on the `DELETE` logs endpoint, check out the [Cloudflare API documentation](/api/resources/ai_gateway/subresources/logs/methods/delete/).

---

# Workers Logpush

URL: https://developers.cloudflare.com/ai-gateway/observability/logging/logpush/

import { Render, Tabs, TabItem } from "~/components";

AI Gateway allows you to securely export logs to an external storage location, where you can decrypt and process them.
You can toggle Workers Logpush on and off in the [Cloudflare dashboard](https://dash.cloudflare.com) settings. This product is available on the Workers Paid plan. For pricing information, refer to [Pricing](/ai-gateway/reference/pricing).

This guide explains how to set up Workers Logpush for AI Gateway, generate an RSA key pair for encryption, and decrypt the logs once they are received.

You can store up to 10 million logs per gateway. If your limit is reached, new logs will stop being saved and will not be exported through Workers Logpush. To continue saving and exporting logs, you must delete older logs to free up space for new logs. Workers Logpush has a limit of 4 jobs and a maximum request size of 1 MB per log.

:::note[Note]

To export logs using Workers Logpush, you must have logs turned on for the gateway.

:::

<Render file="limits-increase" product="ai-gateway" />

## How logs are encrypted

We employ a hybrid encryption model efficiency and security. Initially, an AES key is generated for each log. This AES key is what actually encrypts the bulk of your data, chosen for its speed and security in handling large datasets efficiently.

Now, for securely sharing this AES key, we use RSA encryption. Here's what happens: the AES key, although lightweight, needs to be transmitted securely to the recipient. We encrypt this key with the recipient's RSA public key. This step leverages RSA's strength in secure key distribution, ensuring that only someone with the corresponding RSA private key can decrypt and use the AES key.

Once encrypted, both the AES-encrypted data and the RSA-encrypted AES key are sent together. Upon arrival, the recipient's system uses the RSA private key to decrypt the AES key. With the AES key now accessible, it is straightforward to decrypt the main data payload.

This method combines the best of both worlds: the efficiency of AES for data encryption with the secure key exchange capabilities of RSA, ensuring data integrity, confidentiality, and performance are all optimally maintained throughout the data lifecycle.

## Setting up Workers Logpush

To configure Workers Logpush for AI Gateway, follow these steps:

## 1. Generate an RSA key pair locally

You need to generate a key pair to encrypt and decrypt the logs. This script will output your RSA privateKey and publicKey. Keep the private key secure, as it will be used to decrypt the logs. Below is a sample script to generate the keys using Node.js and OpenSSL.

<Tabs syncKey="JSPlusSSL"> <TabItem label="JavaScript">

```js title="JavaScript"
const crypto = require("crypto");

const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
	modulusLength: 4096,
	publicKeyEncoding: {
		type: "spki",
		format: "pem",
	},
	privateKeyEncoding: {
		type: "pkcs8",
		format: "pem",
	},
});

console.log(publicKey);
console.log(privateKey);
```

Run the script by executing the below code on your terminal. Replace `file name` with the name of your JavaScript file.

```bash
node {file name}
```

</TabItem> <TabItem label="OpenSSL">

1. Generate private key:
   Use the following command to generate a RSA private key:

   ```bash
   openssl genpkey -algorithm RSA -out private_key.pem -pkeyopt rsa_keygen_bits:4096
   ```

2. Generate public key:
   After generating the private key, you can extract the corresponding public key using:

   ```bash
   openssl rsa -pubout -in private_key.pem -out public_key.pem
   ```

</TabItem> </Tabs>

## 2. Upload public key to gateway settings

Once you have generated the key pair, upload the public key to your AI Gateway settings. This key will be used to encrypt your logs. In order to enable Workers Logpush, you will need logs enabled for that gateway.

## 3. Set up Logpush

To set up Logpush, refer to [Logpush Get Started](/logs/get-started/).

## 4. Receive encrypted logs

After configuring Workers Logpush, logs will be sent encrypted using the public key you uploaded. To access the data, you will need to decrypt it using your private key. The logs will be sent to the object storage provider that you have selected.

## 5. Decrypt logs

To decrypt the encrypted log bodies and metadata from AI Gateway, you can use the following Node.js script or OpenSSL:

<Tabs syncKey="JSPlusSSL"> <TabItem label="JavaScript">

To decrypt the encrypted log bodies and metadata from AI Gateway, download the logs to a folder, in this case its named `my_log.log.gz`.

Then copy this JavaScript file into the same folder and place your private key in the top variable.

```js title="JavaScript"
const privateKeyStr = `-----BEGIN RSA PRIVATE KEY-----
....
-----END RSA PRIVATE KEY-----`;

const crypto = require("crypto");
const privateKey = crypto.createPrivateKey(privateKeyStr);

const fs = require("fs");
const zlib = require("zlib");
const readline = require("readline");

async function importAESGCMKey(keyBuffer) {
	try {
		// Ensure the key length is valid for AES
		if ([128, 192, 256].includes(256)) {
			return await crypto.webcrypto.subtle.importKey(
				"raw",
				keyBuffer,
				{
					name: "AES-GCM",
					length: 256,
				},
				true, // Whether the key is extractable (true in this case to allow for export later if needed)
				["encrypt", "decrypt"], // Use for encryption and decryption
			);
		} else {
			throw new Error("Invalid AES key length. Must be 128, 12, or 256 bits.");
		}
	} catch (error) {
		console.error("Failed to import key:", error);
		throw error;
	}
}

async function decryptData(encryptedData, aesKey, iv) {
	const decryptedData = await crypto.subtle.decrypt(
		{ name: "AES-GCM", iv: iv },
		aesKey,
		encryptedData,
	);
	return new TextDecoder().decode(decryptedData);
}

async function decryptBase64(privateKey, data) {
	if (data.key === undefined) {
		return data;
	}

	const aesKeyBuf = crypto.privateDecrypt(
		{
			key: privateKey,
			oaepHash: "SHA256",
		},
		Buffer.from(data.key, "base64"),
	);
	const aesKey = await importAESGCMKey(aesKeyBuf);

	const decryptedData = await decryptData(
		Buffer.from(data.data, "base64"),
		aesKey,
		Buffer.from(data.iv, "base64"),
	);

	return decryptedData.toString();
}

async function run() {
	let lineReader = readline.createInterface({
		input: fs.createReadStream("my_log.log.gz").pipe(zlib.createGunzip()),
	});

	lineReader.on("line", async (line) => {
		line = JSON.parse(line);

		const { Metadata, RequestBody, ResponseBody, ...remaining } = line;

		console.log({
			...remaining,
			Metadata: await decryptBase64(privateKey, Metadata),
			RequestBody: await decryptBase64(privateKey, RequestBody),
			ResponseBody: await decryptBase64(privateKey, ResponseBody),
		});
		console.log("--");
	});
}

run();
```

Run the script by executing the below code on your terminal. Replace `file name` with the name of your JavaScript file.

```bash
node {file name}
```

The script reads the encrypted log file `(my_log.log.gz)`, decrypts the metadata, request body, and response body, and prints the decrypted data.
Ensure you replace the `privateKey` variable with your actual private RSA key that you generated in step 1.

</TabItem> <TabItem label="OpenSSL">

1. Decrypt the encrypted log file using the private key.

Assuming that the logs were encrypted with the public key (for example `public_key.pem`), you can use the private key (`private_key.pem`) to decrypt the log file.

For example, if the encrypted logs are in a file named `encrypted_logs.bin`, you can decrypt it like this:

```bash
openssl rsautl -decrypt -inkey private_key.pem -in encrypted_logs.bin -out decrypted_logs.txt
```

- `-decrypt` tells OpenSSL that we want to decrypt the file.
- `-inkey private_key.pem` specifies the private key that will be used to decrypt the logs.
- `-in encrypted_logs.bin` is the encrypted log file.
- `-out decrypted_logs.txt`decrypted logs will be saved into this file.

2. View the decrypted logs
   Once decrypted, you can view the logs by simply running:

```bash
cat decrypted_logs.txt
```

This command will output the decrypted logs to the terminal.

</TabItem> </Tabs>

---