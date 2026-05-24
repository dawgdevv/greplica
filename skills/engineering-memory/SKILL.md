---
name: engineering-memory
description: Bootstrap or update engineering memory for a code repository using the local `ec` CLI. Use when asked to create repo memory, bootstrap a knowledge graph, create component/flow/claim memory, or generate a memory proposal from code.
---

# Engineering Memory

Use this skill to create useful engineering memory for a repository.

The output is a proposal JSON that can be validated and optionally applied with the `ec` CLI. Bootstrap memory should be shallow and high-signal, not exhaustive.

## CLI Contract

Run commands from the repo root.

```bash
ec init
ec graph read
ec graph search <query>
ec proposal validate <proposal-file>
ec proposal apply <proposal-file>
```

If `ec` is not on `PATH`, use the repo build output:

```bash
node dist/apps/cli/main.js <command>
```

Always validate a proposal before applying it. Apply only when the user explicitly asked to apply, or when the task is a test using an isolated `ENGINEERING_CONTEXT_HOME`.

## Proposal Shape

The proposal file must be JSON:

```json
{
  "title": "Bootstrap repo memory",
  "summary": "Top-level engineering memory for this repository.",
  "creates": {
    "components": [
      {
        "id": "cmp_example",
        "name": "ExampleComponent",
        "code_anchor": "src/example.ts",
        "contains": ["cmp_child_component"]
      }
    ],
    "flows": [
      {
        "id": "flow_example",
        "name": "Example flow",
        "touches": ["cmp_example"],
        "contains": ["flow_child"]
      }
    ],
    "claims": [
      {
        "id": "claim_example",
        "kind": "fact",
        "text": "ExampleComponent participates in Example flow.",
        "truth": "code_verified",
        "intent": "unknown",
        "about": ["cmp_example", "flow_example"]
      }
    ],
    "sources": [],
    "edges": [
      {
        "kind": "touches",
        "from": "flow_existing",
        "to": "cmp_existing"
      }
    ]
  }
}
```

Inline relationship fields and `edges[]` create the same graph edges. Prefer inline fields when creating the subject. Use `edges[]` only for edge-only additions or when inline placement is awkward. Do not manually create edge ids; the CLI generates them.

Allowed claim kinds:

```txt
fact | requirement | decision | task | question | risk
```

Allowed truth values:

```txt
code_verified | source_verified | unknown
```

Allowed intent values:

```txt
intended | accidental | unknown
```

Allowed edge rules:

```txt
Claim -> Component/Flow: about
Component -> Component: contains
Flow -> Flow: contains
Flow -> Component: touches
Component/Flow/Claim -> same kind: supersedes
Claim -> Source: evidenced_by
```

Compact relationship fields:

```txt
component.contains[]      -> Component -> Component contains
component.supersedes[]    -> Component -> Component supersedes

flow.contains[]           -> Flow -> Flow contains
flow.touches[]            -> Flow -> Component touches
flow.supersedes[]         -> Flow -> Flow supersedes

claim.about[]             -> Claim -> Component/Flow about
claim.evidenced_by[]      -> Claim -> Source evidenced_by
claim.supersedes[]        -> Claim -> Claim supersedes
```

Sources are external artifacts such as sessions, PRDs, docs, issues, PRs, or artifacts. Do not create a source just because code was inspected during bootstrap.

## Bootstrap Workflow

1. Run `ec init`.
2. Run `ec graph read` to see existing memory.
3. Inspect the repo shallowly:
   - README and docs if present
   - package/config/build files
   - top-level directory tree
   - app/lib entrypoints
   - tests only when they reveal important behavior
4. Create a proposal with major components, major flows, and useful claims.
5. Include tasks/questions/risks for areas that need deeper inspection.
6. Write the proposal to a temporary JSON file.
7. Run `ec proposal validate <proposal-file>`.
8. Fix validation errors until valid.
9. Apply only if explicitly requested.

## Quality Bar

Create memory that helps a future coding agent orient quickly:

- Prefer important subsystems over tiny helpers.
- For a small repo, prefer roughly 3-8 components unless more are clearly needed.
- Split a component only when the split would help a future agent navigate or change the code.
- Prefer human workflows over function-level traces.
- Use `code_verified` only for claims grounded in inspected code.
- Use `unknown` for intent unless design intent is explicit.
- Add open questions/tasks for areas that look important but were not inspected deeply.
- Do not create questions about rules explicitly defined in this skill unless the code contradicts the rule.
- Keep bootstrap shallow; suggest targeted deep dives rather than trying to cover every file.
