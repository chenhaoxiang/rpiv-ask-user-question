---
doc_type: bug
project: workspace
status: active
truth_mode: maintained
created: 2026-10-14
verified: 2026-10-14
verified_by: manual
---

# Question failure flags

In `0.1.4-fork.4`, missing UI or a mode other than `tui`, and an empty option list, return `isError: true` alongside the existing error text and `{ question, answer: null }` details. Pi's native tool loop uses this flag, not an `Error:` text prefix, to classify the result. These branches open no dialog and reserve no question slot.

Selection, custom input (including empty input), Chat, user decline and cancellation remain normal results. An already-aborted call still returns cancellation before UI/options validation. Schema, tool identity, sequential metadata, concurrent-call rejection and cleanup are unchanged.

`npm test` preserves the original 20 tests and adds 11 regressions: non-TUI modes, missing UI, empty options, subsequent-call readiness and normal answer/cancellation outcomes. The five invalid-environment/options cases failed against the previous source before the two-line runtime fix. Native Pi `1.2.0-fork.1` wrapper/Agent checks additionally exercise schema validation and error propagation with synthetic responses and no real provider requests. Test/pack/isolated load evidence remains distinct from live terminal/IME acceptance and old-session hot-loading.
