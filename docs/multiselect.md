---
doc_type: guide
project: workspace
status: active
truth_mode: maintained
created: 2026-10-14
verified: 2026-11-10
verification_scope: TUI/RPC synthetic regression and isolated native RPC/package loading; no release/install or real terminal/Web acceptance
---

# Structured multi-selection

0.1.4-fork.2 keeps the standalone community 0.1.4 baseline and single-choice result contract. In multiSelect mode, Space toggles ordinary options, arrows navigate and Enter submits checked options in their original order. Empty checked sets stay open with a warning: no default choice is fabricated. Other and Chat are exclusive alternatives that discard checkbox selections; spaces within Other remain input, not toggles. Duplicate labels retain distinct selectedIndices. Those indexes are zero-based positions in options; on-screen row numbering is one-based. Multi results keep a textual answer for older consumers and add answers, selectedIndices and multiSelect:true. Cancel/abort return no answer. Aborting closes the custom dialog through its supplied done callback, guards late input and removes the listener on success or UI failure.

Tests run trusted TypeScript via Node VM modules with actual pinned Pi TUI 1.2.0 and TypeBox 1.3.27 primitives and a synthetic extension host. Five characterization tests passed before edits and remain unchanged. New cases cover toggle/order/duplicate labels/empty selection/Other/Chat/abort/lifecycle cleanup/narrow Chinese and emoji wrapping. They do not open a live UI, call a model, read private sessions or prove every terminal/IME behavior. CI runs the same suite; published package contents exclude tests and development dependencies. Source/merge/release/install remain separate facts.

Top-level development TUI/TypeBox versions are exact pins; transitive test dependencies currently resolve without a committed lockfile. CI is a reproducible command sequence, not a fully immutable dependency tree. Real Pi package loader/RPC checks remain a separate current-host check.

## RPC dialog mode (source candidate)

The unreleased `0.1.4-fork.7` source candidate now supports `ctx.mode === "rpc"` through public `ui.select` and `ui.input`; it never invokes `ui.custom` in RPC. Numbered wire options preserve duplicate labels and descriptions. Multi-select repeatedly toggles explicit positions and requires the separate Submit action; empty selections remain open. Other opens text input and Chat remains an exclusive alternative. The existing textual `answer`, `answers`, zero-based `selectedIndices`, custom/chat markers and cancellation/error contracts are shared with TUI. Abort races and UI failure release the same concurrency guard; a late reply cannot complete a later question.

The optional legacy/custom-component input and work-observation events remain TUI-only. An RPC request is not evidence that a remote client actually displayed a dialog, so this source does not emit fabricated custom-UI intervals. The RPC host owns its visible request/operation lifecycle.

Run `npm test` for the original 51 synthetic cases plus RPC regressions. For the actual native loader/stdin/stdout path (no saved profiles or model requests):

```sh
SDK=/absolute/path/to/pi-coding-agent
node test/native-rpc-smoke.mjs "$SDK" "$PWD/index.ts" "$PWD/tmp/native-rpc"
```

This was exercised on Pi `1.5.0-fork.4` for single choice, custom text, Chat, duplicate-label multi-selection and cancellation, with zero intercepted provider requests. The fixture invokes the actual registered tool from a native extension command; it is not a business-model turn or remote Web rendering acceptance. Package checks must include `rpc-question.ts`; source merge, immutable release, installation and live-session reload remain separate. This change does not publish a version or reload existing Pi sessions.
