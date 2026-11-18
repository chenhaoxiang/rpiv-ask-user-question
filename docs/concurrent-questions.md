---
doc_type: bug
project: workspace
status: active
truth_mode: maintained
created: 2026-10-14
verified: 2026-10-14
verified_by: manual
---

# Concurrent question lifecycle

Pi schedules the tool sequentially. If a host bypasses scheduling, the extension rejects a second pending question with the same safe native `ctx.sessionManager.getSessionId()` before it can replace the first UI. Separate native session IDs do not block each other. When the ID is missing, unsafe, or unreadable, the guard keys on the exact standalone host context instead: it preserves the existing direct-harness contract without treating unrelated unidentified sessions as one. It does not infer session identity from a shared UI, names, or paths.

Both TUI and RPC release the original guard on completion, decline, abort or UI failure. A late RPC reply or retired TUI callback is not an answer to a later call. Abort before the TUI factory arrives does not emit a synthetic input interval. The guard complements Pi scheduling; it does not serialize unrelated tools or independent session processes.
