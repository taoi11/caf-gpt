# PolicyFoo App

## Purpose
LLM workflow for answering policy/regulation questions with citations from authoritative sources.

## Workflow
   1. User sends a question + `policy_set` parameter from the frontend
    - Policy set is from a drop down menu from the frontend, only `DOAD` and `leave policy` are available
   2. Router receives the `user` message only as its the first message
    - Router is the main entry point of this module `src/lib/services/policyFoo/index.ts`
   3. Router validates the `policy_set` parameter
   4. Router selects the appropriate `<policy_set>_foo` based on the `policy_set` and sends the `user` message to the `<policy_set>_foo`
    - `doadFoo` is the only implemented policy set at the moment `src/lib/services/policyFoo/doadFoo/index.ts`
    - `l
   5. Router receives the `assistant` message from the `<policy_set>_foo`
   6. Router sends the `assistant` message to the frontend
   7. User sends a follow-up question + `policy_set` parameter from the frontend
   8. Router receives the `user` + `assistant` message sequence from the frontend
      - Accounts for long running conversations
   9. Router validates the `policy_set` parameter
   10. Router selects the appropriate `<policy_set>_foo` based on the `policy_set` and sends the `user` + `assistant` message sequence to the `<policy_set>_foo`
   ...

## Directory Structure
```
policyFoo/
├── README.md
├── doadFoo/
│   ├── prompts/
│   │   ├── main.md
│   │   ├── finder.md
│   │   └── DAOD-list-table.md

```