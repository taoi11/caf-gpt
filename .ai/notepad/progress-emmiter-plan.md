# PolicyFoo Progress Emitter Plan (KISS Version)

## Current State
- PolicyFoo uses SvelteKit form actions with basic loading states
- Users only see "Processing..." during multi-stage workflows
- No visibility into DOAD (3 stages) or LEAVE (2 stages) processing

## Simple Solution

### 1. Add Progress Messages to Form Response
Instead of SSE complexity, just update the loading message in the textarea area during form submission.

### 2. Minimal Progress Messages
- **DOAD**: "collecting DOAD policies" → "reading [numbers]" → "reflecting on the policies"
- **LEAVE**: "finding the right chapters to read" → "reading chapters: [numbers]"

### 3. Implementation Details

**File 1: Simple Progress Store**
```typescript
// src/lib/stores/progress.ts
import { writable } from 'svelte/store';

export const progressMessage = writable<string>('');
export const isProcessing = writable<boolean>(false);
```

**File 2: Update DOAD Handler**
```typescript
// src/lib/modules/policyFoo/doadFoo/index.ts
// ADD these imports at the top:
import { progressMessage, isProcessing } from '$lib/stores/progress';

// IN handleDOADQuery function, ADD progress updates:
export async function handleDOADQuery(/*...existing params...*/): Promise<PolicyQueryOutput> {
  // Set initial state
  progressMessage.set('Starting DOAD processing');
  isProcessing.set(true);

  try {
    // Stage 1: On finder LLM call
    progressMessage.set('Collecting DOAD policies');
    const finderResult = await findPolicies(/*...*/);

    // Stage 2: On metadata selector
    const doadNumbers = finderResult.selectedPolicies.map(p => p.doadNumber);
    progressMessage.set(`Reading ${doadNumbers.join(', ')}`);
    const metadataResult = await selectMetadata(/*...*/);

    // Stage 3: On main agent LLM call
    progressMessage.set('Reflecting on the policies');
    const finalResult = await processMainAgent(/*...*/);

    return finalResult;
  } finally {
    // Clear progress when done
    progressMessage.set('');
    isProcessing.set(false);
  }
}
```

**File 3: Update LEAVE Handler**
```typescript
// src/lib/modules/policyFoo/leaveFoo/index.ts
// ADD these imports at the top:
import { progressMessage, isProcessing } from '$lib/stores/progress';

// IN handleLeaveQuery function, ADD progress updates:
export async function handleLeaveQuery(/*...existing params...*/): Promise<PolicyQueryOutput> {
  // Set initial state
  progressMessage.set('Starting LEAVE processing');
  isProcessing.set(true);

  try {
    // Stage 1: On finder LLM call
    progressMessage.set('Finding the right chapters to read');
    const finderResult = await findChapters(/*...*/);

    // Stage 2: On main agent LLM call
    const chapterNames = finderResult.selectedChapters.map(c => c.name);
    progressMessage.set(`Reading chapters: ${chapterNames.join(', ')}`);
    const finalResult = await processMainAgent(/*...*/);

    return finalResult;
  } finally {
    // Clear progress when done
    progressMessage.set('');
    isProcessing.set(false);
  }
}
```

**File 4: Update UI**
```svelte
<!-- src/routes/policy/+page.svelte -->
<!-- ADD import at top of script section: -->
<script lang="ts">
  import { progressMessage, isProcessing } from '$lib/stores/progress';
  // ...existing imports...
  
  // ...existing code...
</script>

<!-- MODIFY the textarea section to show progress: -->
<textarea
  id="user_message"
  name="user_message"
  bind:value={userMessage}
  placeholder={$isProcessing ? $progressMessage || 'Processing...' : `Ask a question about ${selectedPolicySet} policies...`}
  rows="3"
  disabled={isLoading}
  required
  class="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed resize-none"
></textarea>

<!-- MODIFY the handleSubmit function: -->
function handleSubmit() {
  if (!userMessage.trim()) return;

  isLoading = true;
  isProcessing.set(true);  // ADD this line
  
  // ...existing code...
}

<!-- MODIFY the form enhance return function: -->
return async ({ result, update }) => {
  isLoading = false;
  isProcessing.set(false);  // ADD this line
  progressMessage.set('');  // ADD this line
  await update();
};
```

### Implementation Notes for LLM Agent

**Key Requirements:**
1. **Preserve existing function signatures** - Don't change function parameters or return types
2. **Add imports carefully** - Only add the progress store import at the top
3. **Find the right insertion points** - Look for LLM calls (finder, metadata-selector, main agent)
4. **Use exact message text** - Match the specified progress messages exactly (including typos)
5. **Clear progress on completion** - Always set empty string when done

**Critical Details:**
- DOAD has 3 stages: collecting → reading → reflecting
- LEAVE has 2 stages: finding → reading
- Progress messages should appear in textarea placeholder when processing
- Use `$progressMessage` and `$isProcessing` stores in Svelte template
- Don't break existing form submission flow
