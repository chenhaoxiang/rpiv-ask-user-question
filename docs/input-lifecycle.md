---
doc_type: spec
project: workspace
status: active
truth_mode: maintained
created: 2026-10-18
verified: 2026-11-05
verified_by: source-and-isolated-sdk
verification_scope: Optional work-question candidate and legacy input lifecycle regression; release/install/native terminal delivery remain separate
updated: 2026-11-05
reviewed: 2026-10-19
release: 0.1.4-fork.6-candidate
---

# Optional input-reminder lifecycle

The owner-approved integration of the personal approval reminder into `pi-notify-mac` needs exact ownership for custom UI. Pi's generic `ui_prompt_start` event does not identify a custom prompt's originating tool; an executing question alone cannot safely classify another overlay. This producer exposes an optional, content-free event rather than a runtime dependency on a notification package.

When the actual question custom-component factory runs, emit on `pi.events`:

```json
{"version":1,"source":"ask_user_question","id":"<opaque tool call id>","phase":"start"}
```

The channel is `pi:input-required`. In the `finally` after the UI promise, emit the same identity with `phase: end`. Validation/no-UI/already-aborted paths, or a host that rejects the custom call before running the factory, emit nothing. Answer, decline, abort and errors after opening emit one matching end. No question title/text, options, answer, tool arguments, session path or credentials are emitted. Call IDs are opaque in-memory correlation only, not authorization or proof of model/session identity.

The observer is optional: absent event-bus support or observer failure never changes the question outcome. No settings, notification, sound or model operation is performed by this producer. Consumers should match version/source/id and must not infer unrelated custom UI ownership from tool execution. Older producer versions continue to ask normally but lack this optional precise reminder signal.

## Optional work-bound question observation (0.1.4-fork.6 candidate)

The maintained source candidate also exposes `pi:work-question:v1` for an optional explicitly declared existing `PiWorkRef` and optional `stageId`. It does not replace or change `pi:input-required`; the old event remains byte-for-byte compatible as the existing generic waiting-input signal. A consumer correlates both by the exact native session/call identity and must produce at most one reminder, not one per channel.

A v1 work observation contains only:

```json
{"version":1,"source":"ask_user_question","sessionId":"<native session>","toolCallId":"<original opaque id>","epoch":"<instance>","seq":1,"phase":"opened|answer-received|closed","observedAt":0,"workAssociation":"declared|unbound|unavailable","workRef":null,"stageId":null,"closeReason":null}
```

`toolCallId` is the exact native ID and equals the old event's `id`. Its total length is1–512 characters, grammar `^[A-Za-z0-9_.:|_-]+(?:/[1-9][0-9]*)*$`; the first segment cannot be `.`/`..`, a drive prefix such as `C:/` is refused, and embedded known credential signatures are refused. Thus provider `|`/`:` and nested `/n` identities are not truncated or rewritten. `sessionId` uses1–128 ASCII alphanumeric/dot/underscore/hyphen characters, excluding `.`/`..` and known credential signatures. If native identity is unavailable/unsafe, the new observer stays silent; the original UI and v1 events still run.

`epoch` changes on a new native extension instance/session start or tree-scope change; shutdown retires it, and `seq` is monotonic only within that epoch. `observedAt` is UTC epoch milliseconds captured when the optional event is emitted, not a fresh owner verification time. Consumers bind the exact current native session/runtime, retire old epochs, and ignore duplicate/older sequence values. This is a forward-only event port: no snapshot RPC, history scanner, polling or collector is installed.

The caller may supply `workRef: { owner, kind, key }` and `stageId` as an observation-only declaration, using the existing Pi/Vista work-reference shape rather than a new task schema. `owner` is a≤256-character namespace with at most one slash; `kind` is `issue|change|task|document`; `key` and stage are≤128-character opaque safe segments. The association is detached from caller mutation. This standalone native producer mirrors the existing identifier/known-signature boundary without a runtime dependency on Vista; it is not a general DLP or origin authenticator.

Both new parameters deliberately use optional unknown-valued schema slots. Ordinary question/options validation remains unchanged, while malformed optional observation metadata must reach the fail-open metadata validator instead of preventing the native question. Neither field supplied means `unbound`; malformed, extra-field, accessor/proxy, unsafe, credential-like or incomplete (stage without work) association means `unavailable`. Both cases publish `workRef:null, stageId:null`. Valid metadata is `declared`, never authenticated ownership or proof that work exists/a decision was applied. No question text, options, answers, paths, credentials, permission flag, or task database is emitted.

`opened` means the actual custom-component factory ran. `answer-received` is emitted only after the original result was built for an option, nonempty custom text or multi-selection; it is not emitted for Chat, empty custom input, decline or abort. `closed` carries the original local outcome (`answered`, `declined`, `aborted`, `error`, `chat`, `empty`), not an inference from v1 end. No-UI, empty-options, pre-abort and pre-factory errors create no interval. Empty means zero-length custom text, not semantic evaluation of what the user wrote. Whitespace or multi-selection is not proof that all business questions were answered.

A late callback from a retired epoch cannot publish into its successor, but its original ToolResult continues through the unchanged native path. There is no new durable question/answer store, answer replay, response interception, decision application or permission API. Partial answer applicability, explicit replacement/revocation and fresh-owner answer adoption remain separate work-owner contracts, not silently completed by this first slice. Registration/emitter failure leaves native outcomes unchanged; synchronous same-process listeners are trusted and not sandboxed or preempted. The event bus owns listener isolation. Real terminal/IME/OS notifications remain separate from synthetic UI and SDK evidence.

`test/input-lifecycle.test.mjs` uses the existing synthetic host/actual TUI primitives; it verifies opaque payloads, factory/validation/error timing and matching closure. The existing single/multi/custom/chat/concurrency/error contracts remain unchanged. Real terminal/IME and native macOS notification acceptance remain separate.

## Post-delivery review boundary (2026-10-19)

A read-only review of the current main branch and installed `0.1.4-fork.5` source found no blocker or major issue. The producer event remains optional, content-free and scoped to the actual question custom component; it does not establish native dialog, terminal/IME or macOS notification acceptance. The paired `pi-notify-mac` consumer is currently selected separately and matches `version`, `source`, opaque `id` and `phase`.

For joint native checks, use the consumer-owned [manual macOS smoke checklist and optimization boundary](https://github.com/chenhaoxiang/pi-notify-mac/blob/main/docs/input-reminders.md#post-delivery-review-and-manual-smoke-boundary-2026-10-19). Do not maintain a second notification checklist here. Question terminal/IME acceptance remains separate, and the checklist does not change this producer contract. The suggested legacy-file helper is not an implemented command or a scheduled producer feature.
