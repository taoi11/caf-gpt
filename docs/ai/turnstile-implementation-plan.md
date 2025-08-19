# Turnstile Implementation Plan

## Overview
Implement Cloudflare Turnstile for bot protection on CAF-GPT project with invisible validation to protect AI-powered forms from abuse.

## Current Project Context
- **SvelteKit** application with Cloudflare Workers
- **Two main forms**: PaceNote generation (`/pacenote`) and Policy queries (`/policy`)
- **Server-side validation** already in place for both forms
- **Environment configuration** system already established

## Implementation Strategy

### 1. Invisible Turnstile Integration
- Use invisible mode to avoid user interaction
- Trigger validation automatically on form submission
- Fallback to visible widget on failure

### 2. Environment Configuration
- Add `TURNSTILE_SECRET_KEY` to environment variables
- Add site key `0x4AAAAAABrw4iUcnqVS_x7o` to public environment
- Extend existing config validation patterns

### 3. Client-Side Implementation
- Create reusable Turnstile component
- Integrate with existing form enhancement patterns
- Handle validation states and errors

### 4. Server-Side Validation
- Add Turnstile token verification to server actions
- Extend existing form validation patterns
- Maintain consistent error handling

## Files to Create/Modify

### New Files
1. `src/lib/core/turnstile.service.ts` - Server-side validation service
2. `src/routes/TurnstileWidget.svelte` - Reusable client component
3. `src/lib/core/turnstile.types.ts` - Type definitions

### Modified Files
1. `src/lib/core/common.types.ts` - Add Turnstile environment variables
2. `src/routes/pacenote/+page.server.ts` - Add Turnstile validation
3. `src/routes/policy/+page.server.ts` - Add Turnstile validation
4. `src/routes/pacenote/PaceNoteForm.svelte` - Integrate Turnstile widget
5. `src/routes/policy/+page.svelte` - Integrate Turnstile widget
6. `src/routes/pacenote/config.server.ts` - Update config validation
7. `src/routes/policy/config.server.ts` - Update config validation

## Technical Details

### Turnstile Configuration (Confirmed Best Practices)
- **Site Key**: `0x4AAAAAABrw4iUcnqVS_x7o` (public)
- **Secret Key**: From `TURNSTILE_SECRET_KEY` environment variable (stored via `wrangler secret put`)
- **Mode**: Invisible with managed challenge (recommended by Cloudflare)
- **Theme**: Auto (respects user preference)
- **Execution**: Render (runs automatically for immediate protection)
- **Appearance**: interaction-only (invisible until interaction needed)

### Cloudflare Workers Integration (Best Practices Verified)
- **Server-side validation**: Mandatory via `https://challenges.cloudflare.com/turnstile/v0/siteverify`
- **Token handling**: Form field `cf-turnstile-response` (standard)
- **IP forwarding**: Use `CF-Connecting-IP` header (optional but recommended)
- **Secret storage**: Environment variables via `wrangler secret put TURNSTILE_SECRET_KEY`
- **Token validation**: Must be done on every form submission

## Security Considerations (Cloudflare Best Practices)
- **Mandatory server-side validation**: Critical security requirement per Cloudflare docs
- **Token lifecycle**: Tokens expire after 300 seconds (5 minutes) and can only be validated once
- **Secret key protection**: Never expose secret key to client-side code
- **Error handling**: Proper handling for invalid, expired, or already-redeemed tokens
- **IP validation**: Optional but recommended for additional security layer

## Testing Strategy
- Unit tests for server-side validation
- Integration tests for form submission flow
- Manual testing for invisible operation
- Error scenario testing
