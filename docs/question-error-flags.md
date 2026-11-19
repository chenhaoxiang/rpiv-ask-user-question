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

Missing UI (including an RPC host without `select` and `input`) and an empty option list return `isError: true` alongside the existing error text and `{ question, answer: null }` details. Pi's native tool loop uses this flag, not an `Error:` text prefix, to classify the result. These branches open no dialog and reserve no question slot.

Before Pi validates the schema, the tool can unwrap one extra JSON layer around the argument object or the `options` array. It does not unquote valid text or recursively decode arguments. Invalid question arguments are tool errors and never open a dialog. CRLF and lone CR in the question, header, labels and descriptions are converted to LF; free-text answers and the content-free event payloads are unchanged.

Selection, custom input (including empty input), Chat, user decline and cancellation remain normal results. An already-aborted call still returns cancellation before UI/options validation. The public schema, tool identity and sequential scheduling are unchanged. See [concurrent question lifecycle](concurrent-questions.md) for guard scope and cleanup.

The `0.1.4-fork.4` suite preserved the original 20 tests and added 11 regressions: non-TUI modes, missing UI, empty options, subsequent-call readiness and normal answer/cancellation outcomes. The five invalid-environment/options cases failed against the previous source before the two-line runtime fix. Native Pi `1.2.0-fork.1` wrapper/Agent checks additionally exercise schema validation and error propagation with synthetic responses and no real provider requests. Test/pack/isolated load evidence remains distinct from live terminal/IME acceptance and old-session hot-loading.
