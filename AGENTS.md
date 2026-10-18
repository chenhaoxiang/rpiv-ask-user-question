# Project guidance

Maintained standalone fork of juicesharp/rpiv-ask-user-question. Use isolated worktrees, preserve `ask_user_question` identity, editable custom answers and host-provided dependencies.

- `main` is our PR-managed integration/release branch; regular merges preserve repair history.
- `upstream-main` mirrors only the standalone community main; read-only upstream fetch is main-only. Do not replace this extension with rpiv-mono or install the mirror.
- Version from the real community base with `-fork.<revision>`. Every validated version needs a GitHub Release, package tarball, provenance and SHA-256 checksums; do not publish in the upstream npm namespace.
- Run `npm test` with synthetic host/actual pinned TUI primitives; preserve characterization assertions. Also verify packed runtime files and isolated Pi startup without prompts. Manual terminal/IME acceptance remains distinct; keep fixtures out of packages and private conversations out of tests.

## Documentation map

- `docs/maintenance/2026-10-18-input-lifecycle-released.md`: fork.5 exact-source PR/CI/Release, flat checksum supplement, installed event-pairing proof and unverified native presentation boundary.

- `docs/maintenance/2026-10-14-question-error-flags-installed.md`: 0.1.4-fork.4 exact review/regular merge/CI, immutable Release, one-source installed-byte verification and native error propagation limits.

- `docs/question-error-flags.md`: UI-unavailable and empty-options failures return structured errors; user decline, custom input, Chat and abort remain normal outcomes.

- `docs/maintenance/2026-10-14-audited-bugfix-installed.md`: 0.1.4-fork.3 red/green defect closure, exact-review-before-merge, main CI, schema1 original Release, installed bytes/native synthetic recheck and activation limits.

- `docs/concurrent-questions.md`: host sequential metadata, explicit per-registration concurrent-call rejection and answer/cancel/abort/UI-failure cleanup regression.
- `docs/input-lifecycle.md`: optional opaque `pi:input-required` start/end events emitted only around the actual question custom UI for precise cooperating reminders.

- `docs/maintenance/2026-10-14-optimization-installed.md`: 0.1.4-fork.2 exact-source normal merge, CI, fresh-download checksums, installed bytes, combined loader and rollback/activation boundaries.

- `docs/multiselect.md`: checkbox interaction, exclusive Other/Chat, compatible result fields, abort cleanup and synthetic regression scope.

- `README.md` / `README.zh-CN.md`: English-first/complete Chinese behavior, installation and limitations.
- `docs/releasing.md`: version normalization, branches, per-version publishing and package verification.
