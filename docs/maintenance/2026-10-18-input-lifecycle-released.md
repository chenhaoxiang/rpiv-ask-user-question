---
doc_type: report
project: workspace
status: completed
truth_mode: snapshot
created: 2026-10-18
verified: 2026-10-18
verified_by: manual
release: 0.1.4-fork.5
---

# 0.1.4-fork.5 opaque input lifecycle delivery

- [PR #12](https://github.com/chenhaoxiang/rpiv-ask-user-question/pull/12) merged normally at `815fcd9ba8a2a39c015867c609ae8e422e77c4c5`; merged-main CI `39135040997` passed. Exact-head suite: **36/36** with zero skips. Independent `codex-local/kimi-k3:high` review: **OK with notes**, no blocker/major; full record was posted to the PR before merge.
- Immutable [Release v0.1.4-fork.5](https://github.com/chenhaoxiang/rpiv-ask-user-question/releases/tag/v0.1.4-fork.5) targets the exact merge. Package SHA256: `c17ab9bd95f37af40a550e60194ae46cfe03095031ed98e5a49313e2e4db8e1c`; original manifest SHA256: `7c084bab1e2b2e84d26e2c11d6429466fd371bdea0aa93b01a17e4c3abe7484d`.
- The producer emits `pi:input-required` only around the actual question custom component. Payload is version/source/opaque call-id/phase; no question text, options, answers, session paths or credentials. Observer absence/failure, validation, no-UI, abort, pre-factory rejection and UI errors preserve question outcomes.
- Fresh public downloads passed the supplementary `DOWNLOAD-SHA256SUMS` flat-directory check. The original `SHA256SUMS` contains build-relative paths and remains unchanged; the supplement is not replacement provenance.
- The installed git source `@0.1.4-fork.5` resolves to the merged source and its release tarball files were compared byte-for-byte. Installed Notify/Ask integration proof used the actual installed modules with virtualized transport: opaque event pairing, alert cancellation and no private prompt leakage passed. No real model, notification, sound, terminal or live-session hot-load acceptance was claimed.

See [input lifecycle contract](../input-lifecycle.md) and [release maintenance](../releasing.md). Previous `0.1.4-fork.4` remains available as a rollback asset and is no longer selected in the personal settings.
