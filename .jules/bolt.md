## 2026-04-05 - Headers parsing in CloudflareEmailWorkerHandler
**Learning:** `headers.forEach` inside `buildHeaderMap` iterates over Cloudflare Worker `Headers`, and multiple iterations may be a small overhead. However, the iteration over `Headers` is fine. A bigger issue is the construction of a comma-separated string `normalized[lowerKey] = \`\${normalized[lowerKey]}, \${value}\`;`

Actually, there is another issue in `src/email/utils/EmailValidator.ts`. In `validateRecipients`, it checks `emailAddressSchema.safeParse(recipient)` inside a loop over `allRecipients`. `emailAddressSchema` has a regex `.match(/<([^>]+)>/)` and then `z.string().email()`. Zod's `safeParse` is synchronous, but `z.string().email()` is known to be slightly slower than a plain regex, but that's a micro-optimization.

Let's look at `src/email/utils/EmailNormalizer.ts`:
```typescript
export function normalizeEmailAddress(email?: string | null): string {
  if (!email || typeof email !== "string") {
    return "";
  }

  const match = email.match(/<([^>]+)>/);
  const extracted = match ? match[1] : email;

  return extracted.toLowerCase().trim();
}
```
This is quite fast.

Let's look at `src/email/CloudflareEmailWorkerHandler.ts`:
```typescript
  private buildHeaderMap(headers: Headers): Record<string, string> {
    const normalized: Record<string, string> = {};

    headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (normalized[lowerKey]) {
        normalized[lowerKey] = `${normalized[lowerKey]}, ${value}`;
        return;
      }
      normalized[lowerKey] = value;
    });

    return normalized;
  }
```
Headers `.toLowerCase()` might be redundant since `Headers.forEach` keys are usually already lowercase according to Fetch API specs, but let's leave it.

Let's look at `src/email/CloudflareEmailWorkerHandler.ts`:
```typescript
    const isAuthorizedDomain = this.config.authorization.authorizedDomains.some((domain) =>
      senderEmail.endsWith(`@${domain}`)
    );
```

Let's look at `src/email/utils/EmailValidator.ts`:
```typescript
// Check for suspicious content patterns
function containsSuspiciousContent(content: string): boolean {
  const suspiciousPatterns = [
    /\b(urgent|immediate|act now|limited time)\b/i,
    /\b(click here|download now|free money)\b/i,
    /\b(nigerian prince|lottery winner|inheritance)\b/i,
    /\b(phishing|malware|virus)\b/i,
  ];

  return suspiciousPatterns.some((pattern) => pattern.test(content));
}
```
Creating the array of regexes on every call to `containsSuspiciousContent` is unnecessary. We can move `suspiciousPatterns` outside the function to avoid compiling the regexes every time.

Similarly, `isSuspiciousDomain`:
```typescript
function isSuspiciousDomain(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return false;

  const suspiciousDomains = [
    "tempmail.org",
    "10minutemail.com",
    "guerrillamail.com",
    "mailinator.com",
  ];

  return suspiciousDomains.includes(domain);
}
```
`suspiciousDomains` array is re-created every time. Could be moved outside and ideally be a `Set` for `O(1)` lookup. This is heavily executed since it's called for every recipient of every email.

Let's fix these in `src/email/utils/EmailValidator.ts`.