# Plan for Consolidating R2 Utility Functions

## Current State

- Multiple modules have their own R2 utility implementations:
  - `src/lib/modules/paceNote/r2.util.ts`: Contains a simple readFileAsText function
  - `src/lib/modules/policyFoo/r2.util.ts`: Contains multiple functions including error handling and more complex operations

## Goal

Consolidate all R2 utility functions into a single shared library in `lib/server/` to eliminate redundancy, improve maintainability, and ensure consistent behavior across modules.

## Plan

### Step 1: Create Consolidated Utility Module

- Create file: `src/lib/server/r2.util.ts`
- Include all functions from both current implementations:
  - `readFileAsText` (from paceNote)
  - All functions from policyFoo's implementation:
    - `readPolicyFileAsText`
    - `readMultiplePolicyFiles`
    - `policyFileExists`
    - `listPolicyFiles`
    - `constructPolicyFilePath`
    - `parsePolicyNumbers`

### Step 2: Standardize Error Handling

- Implement a consistent error handling approach for all R2 operations
- Create standardized error types for R2-related errors

### Step 3: Update Module Imports

- Change imports in paceNote module from './r2.util.js' to '../server/r2.util'
- Change imports in policyFoo module from '../r2.util' to '../../server/r2.util'

### Step 4: Documentation and Testing

- Add comprehensive documentation to the consolidated utility file
- Create tests for all R2 utility functions if not already present

### Step 5: Handle Module-Specific Functionality

- For functions that are primarily used by a single module (like `parsePolicyNumbers`), consider:
  - Keeping them in the centralized utility for now
  - Adding deprecation warnings if needed in the future
  - Documenting their specific usage and potential module coupling

### Step 6: Review and Cleanup

- Remove redundant local R2 utility files after verification that all modules are using the centralized version
- Update any relevant documentation about R2 utilities

## Files to Modify

1. Create new:

   - `src/lib/server/r2.util.ts`

2. Update imports in:
   - `src/lib/modules/paceNote/service.ts`
   - `src/lib/modules/paceNote/index.ts`
   - `src/lib/modules/policyFoo/doadFoo/finder.ts`
   - `src/lib/modules/policyFoo/leaveFoo/index.ts`

## Implementation Steps

1. Create the consolidated R2 utility file with all functions and standardized error handling.
2. Update imports in each module to use the centralized utility.
3. Test thoroughly to ensure no functionality is broken.
4. Remove local copies of R2 utilities after verification.
5. Document changes and update any related documentation.

This plan provides a structured approach to consolidating the R2 utility functions, ensuring consistency across the codebase while minimizing risk during migration.
