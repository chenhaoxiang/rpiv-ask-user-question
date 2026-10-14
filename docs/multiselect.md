---
doc_type: guide
project: workspace
status: active
truth_mode: maintained
created: 2026-10-14
verified: 2026-10-14
---

# Structured multi-selection

0.1.4-fork.2 keeps the standalone community 0.1.4 baseline and single-choice result contract. In multiSelect mode, Space toggles ordinary options, arrows navigate and Enter submits checked options in their original order. Empty checked sets stay open with a warning: no default choice is fabricated. Other and Chat are exclusive alternatives that discard checkbox selections; spaces within Other remain input, not toggles. Duplicate labels retain distinct selectedIndices. Those indexes are zero-based positions in options; on-screen row numbering is one-based. Multi results keep a textual answer for older consumers and add answers, selectedIndices and multiSelect:true. Cancel/abort return no answer. Aborting closes the custom dialog through its supplied done callback, guards late input and removes the listener on success or UI failure.

Tests run trusted TypeScript via Node VM modules with actual pinned Pi TUI 1.2.0 and TypeBox 1.3.27 primitives and a synthetic extension host. Five characterization tests passed before edits and remain unchanged. New cases cover toggle/order/duplicate labels/empty selection/Other/Chat/abort/lifecycle cleanup/narrow Chinese and emoji wrapping. They do not open a live UI, call a model, read private sessions or prove every terminal/IME behavior. CI runs the same suite; published package contents exclude tests and development dependencies. Source/merge/release/install remain separate facts.

Top-level development TUI/TypeBox versions are exact pins; transitive test dependencies currently resolve without a committed lockfile. CI is a reproducible command sequence, not a fully immutable dependency tree. Real Pi package loader/RPC checks remain a separate current-host check.
