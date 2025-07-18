# PolicyFoo Chat Layout Optimization - Implementation Instructions

## Task
Optimize the PolicyFoo page (`/policy`) chat layout for tablet screens to prevent the conversation box from becoming too tall after the first message is sent.

## Current Issues
- Conversation container uses `min-h-screen` making it full viewport height
- Header remains large even after conversation starts
- Users must scroll the entire page instead of just chat content
- Form can get pushed off-screen on tablets

## Implementation Requirements

### 1. Dynamic Header Component (`src/routes/policy/+page.svelte`)

**Objective**: Make header responsive to conversation state

**Changes Required**:
- Implement conditional header sizing based on `messages.length > 0`
- **Initial state** (no messages): Large header with full title and description
- **Active conversation**: Compact header to save vertical space
  - Reduce title from `text-4xl` to `text-2xl` 
  - Reduce description text size and/or hide completely
  - Reduce header padding and margins (`mb-8` → `mb-4`, etc.)

**Implementation Pattern**:
```svelte
<header class="{messages.length > 0 ? 'mb-4' : 'mb-8'} ...">
  <h1 class="{messages.length > 0 ? 'text-2xl' : 'text-4xl'} ...">
```

### 2. Conversation Container Height Control (`src/routes/policy/PolicyComponents/MessageList.svelte`)

**Objective**: Constrain chat height for tablet viewing with scrollable content

**Changes Required**:
- Remove `min-h-screen` from message container
- Add tablet-specific max height constraints:
  - **Tablet Portrait** (768px-1024px): `max-h-[50vh]` or `max-h-[60vh]`
  - **Tablet Landscape** (1024px+): `max-h-[60vh]` or `max-h-[70vh]`
- Ensure `overflow-y-auto` is preserved for scrolling
- Maintain auto-scroll to bottom behavior

**Implementation Pattern**:
```svelte
<div class="flex-1 p-4 overflow-y-auto flex flex-col gap-6 md:max-h-[50vh] lg:max-h-[60vh]">
```

### 3. Layout Container Adjustments (`src/routes/policy/+page.svelte`)

**Objective**: Optimize main layout spacing for conversation mode

**Changes Required**:
- Reduce gap between main sections when conversation is active
- **Initial state**: `gap-6` for spacious welcome layout
- **Active conversation**: `gap-3` or `gap-4` for compact layout
- Ensure policy selector and form remain visible without page scrolling

**Implementation Pattern**:
```svelte
<main class="flex-1 flex flex-col {messages.length > 0 ? 'gap-3' : 'gap-6'}">
```

### 4. Form Optimization (Optional Enhancement)

**Objective**: Improve tablet form interaction

**Suggested Improvements**:
- Better textarea sizing for tablets
- Optimized button placement and touch targets
- Consider reducing form height in conversation mode

## Success Criteria

After implementation, the PolicyFoo page should:
1. **Initial Load**: Show welcoming layout with full header
2. **After First Message**: 
   - Compact header saves vertical space
   - Chat area constrained to ~50-60% viewport height on tablets
   - Chat content scrolls within container
   - Policy selector and form always visible
   - No need to scroll entire page to access form

## Testing
- Verify on tablet devices (768px-1024px width)
- Test both portrait and landscape orientations  
- Ensure conversation flows work smoothly
- Validate auto-scroll behavior is preserved
