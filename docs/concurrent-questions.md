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

A parent-only audit reproduced two custom questions replacing the same native editor; the second answer returned while the first call remained pending until abort. Pi1.2 defaults to parallel tools, so tool registration now requests executionMode sequential. A per-registration awaiting guard also rejects unsupported direct/nested concurrent calls before they can replace the first UI. This is explicit failure, not a guessed answer or a hidden queue. The flag is released in finally after answer, cancel, abort or UI rejection; existing single/multi/custom/chat and abort-listener contracts remain unchanged.

Before the fix, the appended tests failed on missing sequential metadata and the concurrent UI replacement. The original17 cases remain unchanged; the full20-case synthetic host/actual TUI suite passes. Current Pi1.2 metadata/isolated package checks are separate from live terminal/IME acceptance. The guard complements host scheduling; it does not claim to serialize arbitrary other tools or independent session processes.
