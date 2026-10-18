---
doc_type: spec
project: workspace
status: active
truth_mode: maintained
created: 2026-10-18
verified: 2026-10-18
verified_by: manual
release: 0.1.4-fork.5
---

# Optional input-reminder lifecycle

The owner-approved integration of the personal approval reminder into `pi-notify-mac` needs exact ownership for custom UI. Pi's generic `ui_prompt_start` event does not identify a custom prompt's originating tool; an executing question alone cannot safely classify another overlay. This producer exposes an optional, content-free event rather than a runtime dependency on a notification package.

When the actual question custom-component factory runs, emit on `pi.events`:

```json
{"version":1,"source":"ask_user_question","id":"<opaque tool call id>","phase":"start"}
```

The channel is `pi:input-required`. In the `finally` after the UI promise, emit the same identity with `phase: end`. Validation/no-UI/already-aborted paths, or a host that rejects the custom call before running the factory, emit nothing. Answer, decline, abort and errors after opening emit one matching end. No question title/text, options, answer, tool arguments, session path or credentials are emitted. Call IDs are opaque in-memory correlation only, not authorization or proof of model/session identity.

The observer is optional: absent event-bus support or observer failure never changes the question outcome. No settings, notification, sound or model operation is performed by this producer. Consumers should match version/source/id and must not infer unrelated custom UI ownership from tool execution. Older producer versions continue to ask normally but lack this optional precise reminder signal.

`test/input-lifecycle.test.mjs` uses the existing synthetic host/actual TUI primitives; it verifies opaque payloads, factory/validation/error timing and matching closure. The existing single/multi/custom/chat/concurrency/error contracts remain unchanged. Real terminal/IME and native macOS notification acceptance remain separate.
