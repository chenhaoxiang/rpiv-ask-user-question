# rpiv-ask-user-question — maintained fork

A Pi extension that registers `ask_user_question`, a structured question tool for decisions that cannot be made safely from the current request alone.

This repository is the maintained fork:

<https://github.com/chenhaoxiang/rpiv-ask-user-question>

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

## When to use it

Use the tool when the request is underspecified and a concrete choice changes the implementation, scope, external contract, or acceptance criteria. Prefer it over asking the user to type an unstructured reply in prose, because the selection and decision context remain visible to the session.

Do not use it for choices that can be made safely as a reversible implementation detail.

## Compatibility and limits

- Uses Pi's public extension APIs and host-provided `@earendil-works/pi-coding-agent`, `@earendil-works/pi-tui`, and `typebox` packages.
- Requires an interactive Pi UI for the selector. Non-interactive print/RPC use returns an explicit UI-unavailable result instead of guessing.
- The extension does not write settings, credentials, prompts, or session files outside Pi's normal tool-result/session mechanism.
- The `multiSelect` field remains part of the public schema for Claude-Code parity; option selection and custom text stay visible in the same question dialog.

## Development

The package is intentionally small and loads TypeScript directly through Pi's package loader. Use a disposable Pi configuration directory for local checks:

```bash
npm install --ignore-scripts
```

Do not use production credentials or private session transcripts as fixtures. After changing the extension, run a Pi startup smoke and verify the tool schema and custom-answer path in an interactive test session.

## License

MIT
