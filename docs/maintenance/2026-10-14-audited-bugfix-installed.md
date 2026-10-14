---
doc_type: handoff
project: workspace
status: completed
truth_mode: snapshot
created: 2026-10-14
verified: 2026-10-14
verified_by: manual
---

# 0.1.4-fork.3 audited bugfix delivery

- Parent-only audit reproduced the concurrency/rejected-status/UI-interruption defect. The new regressions first failed against the old source; existing assertions and historical evidence remain unchanged. Feature PR [#8](https://github.com/chenhaoxiang/rpiv-ask-user-question/pull/8) normally merged at `6536340680813d404c35cb5377e3e62bf8fcf686` after parent native/source checks and the exact-head independent codex-local/deepseek-flash:high final review receipt was read and posted. Review is AI engineering evidence, not a second human approval. [Posted exact-head review](https://github.com/chenhaoxiang/rpiv-ask-user-question/pull/8#issuecomment-6162686057) predates the recorded feature merge.
- **20/20 local synthetic tests pass**. Exact-source main CI [38524879071](https://github.com/chenhaoxiang/rpiv-ask-user-question/actions/runs/38524879071) succeeded. Source/local/native-synthetic/CI and actual platform delivery remain distinct.
- Immutable [v0.1.4-fork.3](https://github.com/chenhaoxiang/rpiv-ask-user-question/releases/tag/v0.1.4-fork.3) attaches exactly the tarball, schema1 original release-manifest.json and SHA256SUMS. Fresh download verified both entries and current Pi1.2 isolated RPC registration. Package SHA256 `1230a065dd5eaa7bc26fea0da417369dcb5682c6057854c88eaab3a7963dec7e`; original manifest SHA256 `e79154fd0f3bcb015a549a98a751bad6b9d8cb6bb2846901d9f859c445a9e9c0`. Unlike the previous release, no metadata projection/supplement is needed.
- Permanent install `/Users/robotmac/.pi/agent/packages/rpiv-ask-user-question/0.1.4-fork.3`: **10 shipped files** match the freshly downloaded package byte-for-byte. Installed RPC passes. This batch replaces exactly three package sources; unrelated settings and pi-better-compaction0.7.4-fork.2 are unchanged, old versions retained, forced restarts0.
- Parent reran actual installed source: real Pi1.2 extension-tool wrapper/default-parallel Agent scheduler + native custom-UI lifecycle with four synthetic responses returned both question answers in order and propagated Todo isError while retaining completed state. Notify installed source resumed the interrupted settle exactly once under virtual timers/FS/OS transport; zero real notifications. Four-package normal loader/fresh AgentSession additionally reports zero load errors/messages/model calls. These do not prove live terminal/IME, all ambient plugins, real model/billing or macOS delivery.
- Owner-only backup/rollback receipt `~/.pi/agent/backups/three-extension-bugfix-20261014/`; rollback not exercised. New sessions adopt disk changes; busy or opaque-dependent sessions were not forced to reload. This docs-only handoff changes no shipped code or immutable asset.
