# Project guidance

Maintained standalone fork of juicesharp/rpiv-ask-user-question. Use isolated worktrees, preserve `ask_user_question` identity, editable custom answers and host-provided dependencies.

- `main` is our PR-managed integration/release branch; regular merges preserve repair history.
- `upstream-main` mirrors only the standalone community main; read-only upstream fetch is main-only. Do not replace this extension with rpiv-mono or install the mirror.
- Version from the real community base with `-fork.<revision>`. Every validated version needs a GitHub Release, package tarball, provenance and SHA-256 checksums; do not publish in the upstream npm namespace.
- No automated functional suite currently exists. Verify packed runtime files and isolated Pi startup without prompts; manual interactive UI acceptance is distinct. Keep tmp fixtures out of published packages and private conversations out of tests.

## Documentation map

- `README.md` / `README.zh-CN.md`: English-first/complete Chinese behavior, installation and limitations.
- `docs/releasing.md`: version normalization, branches, per-version publishing and package verification.
