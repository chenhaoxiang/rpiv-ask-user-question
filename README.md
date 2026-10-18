# rpiv-ask-user-question — maintained fork

English | [中文](README.zh-CN.md)

A Pi extension that registers `ask_user_question`, a structured question tool for decisions that cannot be made safely from the current request alone.

This repository is the maintained fork:

<https://github.com/chenhaoxiang/rpiv-ask-user-question>

## Releases and branch policy

The current maintained release is **0.1.4-fork.5**, based on community **0.1.4**. It is published from the merged main source with an immutable package, source manifest and checksums. Fork releases use `<community-version>-fork.<revision>`; the fork revision increases without pretending to be a new upstream release.

- `main`: our maintained integration and release branch, including fork fixes.
- `upstream-main`: an exact mirror of the community's `main`, with no fork commits. Never install from this branch.
- Changes enter `main` through reviewed pull requests; existing branches and history are retained.

Install a reproducible release:

```bash
pi install git:github.com/chenhaoxiang/rpiv-ask-user-question@v0.1.4-fork.5
```

[GitHub Releases](https://github.com/chenhaoxiang/rpiv-ask-user-question/releases) include the installable package tarball, a provenance manifest, and `SHA256SUMS`. These GitHub releases are not npm publications under the upstream author's namespace. See [release maintenance](docs/releasing.md) for asset installation and future releases.

The previously unqualified fork package version `0.1.6` is standardized as `0.1.4-fork.1` using its real community base. This is a naming correction, not a rollback of custom-answer or host-import fixes.

## Install this fork

```bash
pi install git:github.com/chenhaoxiang/rpiv-ask-user-question@main
```

The upstream npm package and this fork are separate sources. Pin a reviewed commit when reproducibility matters:

```bash
pi install git:github.com/chenhaoxiang/rpiv-ask-user-question@<reviewed-commit>
```

Restart Pi or run `/reload` after installation.

## Tool behavior

The extension exposes one tool:

```ts
ask_user_question({
  question: "Which implementation should we keep?",
  header: "Implementation",
  options: [
    { label: "Small patch", description: "Keep the existing architecture." },
    { label: "Refactor", description: "Move the behavior into a shared module." }
  ],
  multiSelect: false
})
```

The UI provides:

- selectable options with optional descriptions;
- an **Other** option with an editable inline text field;
- a **Chat about this** option for continuing the discussion without forcing a categorical choice;
- keyboard navigation, cursor movement, multiline input, bracketed paste, and cancellation;
- structured result details that preserve the question, selected answer, custom-answer marker, or chat marker in the session history.

The tool returns a clear result for each outcome:

- selected option;
- custom text answer, including an explicit `(no input)` case;
- request to continue the conversation;
- user decline;
- unavailable UI in non-interactive mode;
- invalid empty option list.

Unavailable UI and empty options return `isError: true`; selection, custom input, Chat, decline and cancellation remain normal outcomes. See [error-result contract](docs/question-error-flags.md).

## When to use it

Use the tool when the request is underspecified and a concrete choice changes the implementation, scope, external contract, or acceptance criteria. Prefer it over asking the user to type an unstructured reply in prose, because the selection and decision context remain visible to the session.

Do not use it for choices that can be made safely as a reversible implementation detail.

## Compatibility and limits

- Uses Pi's public extension APIs and host-provided `@earendil-works/pi-coding-agent`, `@earendil-works/pi-tui`, and `typebox` packages.
- Requires an interactive Pi UI for the selector. Non-interactive print/RPC use returns an explicit UI-unavailable result instead of guessing.
- The extension does not write settings, credentials, prompts, or session files outside Pi's normal tool-result/session mechanism.
- When the host event bus is available, the real custom UI interval emits opaque `pi:input-required` start/end events (`version`, source, call id and phase only) for cooperating notification extensions; prompt text, options and answers are never emitted.
- `multiSelect: true` enables checkboxes: Space toggles and Enter submits checked options in original order; Other/Chat are exclusive alternatives. Results add `answers`, `selectedIndices`, `multiSelect` while preserving textual `answer`.

## Concurrent calls

The tool requests sequential host execution. Unsupported direct/nested concurrent calls explicitly fail rather than replacing an active question. Answer, cancel, abort and UI errors release the guard; see [concurrency contract](docs/concurrent-questions.md).

## Development

Run `npm test` on Node24+ for synthetic host/dialog tests with actual pinned Pi TUI primitives. Existing single-choice characterization remains unchanged. Package loading, live terminal/IME acceptance and model requests are separate; see [multi-selection contract](docs/multiselect.md). Use a disposable Pi directory for local checks:

```bash
npm install --ignore-scripts
```

Do not use production credentials or private session transcripts as fixtures. After changing the extension, run a Pi startup smoke and verify the tool schema and custom-answer path in an interactive test session.

## License

MIT
