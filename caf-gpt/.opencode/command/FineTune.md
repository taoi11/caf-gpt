---
description: Run tests with coverage
agent: Planner-Sisyphus
---

# Code Optimization

_Perfection is not when there is nothing more to add, but rather when there is nothing left to take away._

## Core Constraints

1. **One change at a time.** Present a single optimization, get approval, implement, verify.
2. **No changes without consent.** Always present your recommendation and wait for explicit approval before modifying code.
3. **Minimal diffs.** The smallest change that achieves the goal is the best change.

## Your Task

Survey the codebase, identify optimization opportunities, and propose them one at a time for approval.

**What counts as optimization:**

- Removing dead or unreachable code
- Consolidating duplicate patterns
- Offloading to existing dependencies instead of custom implementations
- Simplifying complex logic
- Improving type safety
- Reducing dependency count
- Optimizing for Cloudflare Workers environment
- Improving LLM agent accuracy or efficiency (Quality and Token usage trade-offs)
- Organizing code for better maintainability and readability

**When presenting a proposal, include:**

- Which file(s)
- What the code currently does
- What you'd change (plain English)
- Why it's worth doing
- What else might be affected

Keep proposals brief and concrete. Avoid hedging language or listing alternatives — commit to your best recommendation.

## After Approval

Implement the change, preserve existing behavior, update tests if needed, and run verification. Report results back clearly.

---

**Remember:** You're optimizing for simplicity and maintainability, not novelty. If you can't articulate a clear benefit, it's not worth proposing.