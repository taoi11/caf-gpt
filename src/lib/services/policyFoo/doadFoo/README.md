# policyFoo

## Purpose
LLM workflow for answering questions related DOAD policies with citations from authoritative sources.

## Workflow
  1. Receives a user message `policyFoo` Router as init. Or a continuation of a conversation ( `user` + `assistant` message sequence)
  2. Routes the message or conversation to `src/lib/services/policyFoo/doadFoo/finder.ts` 
  3. Receives the `assistant` message from finder.ts
    - The `assistant` message contains the DOAD policy numbers relevant to the user question
  4. Pulls the relevant DOAD policies from S3 bucket
    - Ref `src/lib/services/paceNote/r2.util.ts` for an example
    - Policies are in `Bucket: policies` file example `doad/1000-1.md`
    - All policies are in markdown format in the `doad` folder in the `policies` bucket
  5. Sends the user message or conversation to the `src/lib/services/policyFoo/doadFoo/main.ts`
  6. Receives the `assistant` message from `main.ts`
    - Adds the `assistant` message to the conversation end and updates the conversation history
  7. Sends the updated conversation to the `policyFoo` Router