---
doc_type: handoff
project: workspace
status: completed
truth_mode: snapshot
created: 2026-10-14
verified: 2026-10-14
verified_by: manual
---

# 0.1.4-fork.4 failure-flag delivery

- Parent-only native audit found UI-unavailable/empty-options failures were recorded as successes. The two return branches now add `isError: true`; normal answers/custom/Chat/decline/abort, schema, sequential metadata and cleanup are unchanged. See [contract](../question-error-flags.md).
- Original 20 tests remain unchanged; 11 added regressions. Fresh exact-base `23fc224d6ff7184c46838e59ca4a60322adc9980` archive plus the hashed new test reproduced five failures; fixed source passes **31/31** at reviewed head and merged source. Historical logs were retained, not backfilled.
- [PR #10](https://github.com/chenhaoxiang/rpiv-ask-user-question/pull/10) ordinarily merged at `feaa9d68c3b025aa449d6c4c7491b4679ff7d238`, with base/head as its two parents. Final independent `codex-local/deepseek-flash:high` review bound head `2bf2414fc6ef5a40d6f8fe6851d22ea43a874e24`; [full posted review](https://github.com/chenhaoxiang/rpiv-ask-user-question/pull/10#issuecomment-6167106455) predates merge. Review is AI engineering evidence, not a second human approval. Exact-head CI [38554980020](https://github.com/chenhaoxiang/rpiv-ask-user-question/actions/runs/38554980020) and exact-source main CI [38555475523](https://github.com/chenhaoxiang/rpiv-ask-user-question/actions/runs/38555475523) succeeded.
- Immutable [v0.1.4-fork.4](https://github.com/chenhaoxiang/rpiv-ask-user-question/releases/tag/v0.1.4-fork.4) has three original assets: tarball, schema1/canonical-URL release-manifest.json and SHA256SUMS. Its source is the merge SHA above. Fresh download verified both checksum entries and all three GitHub asset digests. Package SHA256 `364a62591881788e894428342b700708ed860a0e50dadfd0bdacd35f9aab620f`; manifest SHA256 `dc159c315fb3dc5585fff8293bfe9f9822e1f3659cdab9ee2b737047b3256e7d`.
- Permanent install `/Users/robotmac/.pi/agent/packages/rpiv-ask-user-question/0.1.4-fork.4`: **11 shipped files** match the freshly downloaded package byte-for-byte, with the original manifest installed separately. Exactly one settings package source changed (Ask); unrelated settings, Todo/Notify/Compaction sources and Vista autoload entry were preserved, old Ask0.1.4-fork.3 retained, forced restarts0.
- Source/packed/downloaded/installed checks use the actual Pi1.2 tool wrapper and Agent schema/loop with two synthetic responses: five invalid UI/options cases are errors and four normal-answer cases are not. UI answers in this native proof are synthetic; separate unit tests use actual pinned TUI primitives. All four package phases also passed actual Pi1.2 isolated RPC loading without prompts. Four explicit installed packages additionally passed normal discovery/fresh AgentSession with zero errors/messages/model calls; this does not prove all ambient plugins or old-session hotload.
- Owner-only backup/rollback receipt `~/.pi/agent/backups/ask-error-flags-20261014/`; rollback not exercised. No live terminal/IME, real provider/billing or macOS delivery acceptance is claimed. Activate disk changes in a new session or reload an idle session, not by forcing busy/opaque-dependent sessions. This docs-only handoff changes no shipped code or immutable asset.
