import { type ExtensionAPI, DynamicBorder, type Theme } from "@earendil-works/pi-coding-agent";
import { Container, Editor, Spacer, Text, getKeybindings, matchesKey } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import {
	WrappingSelect,
	type WrappingSelectItem,
	type WrappingSelectTheme,
} from "./wrapping-select.js";

const MAX_VISIBLE_ROWS = 10;

const TYPE_SOMETHING_LABEL = "Type something.";
const CHAT_ABOUT_THIS_LABEL = "Chat about this";
const NAV_HINT = "Enter to select · ↑/↓ to navigate · Esc to cancel";

const DECLINE_MESSAGE = "User declined to answer questions";
const CHAT_CONTINUATION_MESSAGE = "User wants to chat about this. Continue the conversation to help them decide.";
const CHAT_ANSWER_TAG = "User wants to chat about this";
const NO_INPUT_PLACEHOLDER = "(no input)";
const ERROR_NO_UI = "Error: UI not available (running in non-interactive mode)";
const ERROR_NO_OPTIONS = "Error: No options provided";

const KEYBIND_UP = "tui.select.up";
const KEYBIND_DOWN = "tui.select.down";
const KEYBIND_CONFIRM = "tui.select.confirm";
const KEYBIND_CANCEL = "tui.select.cancel";

interface QuestionOption {
	label: string;
	description?: string;
}

interface QuestionParams {
	question: string;
	header?: string;
	options: QuestionOption[];
	multiSelect?: boolean;
}

interface ToolDetails {
	question: string;
	answer: string | null;
	wasCustom?: boolean;
	wasChat?: boolean;
	answers?: string[];
	selectedIndices?: number[];
	multiSelect?: boolean;
}

export function registerAskUserQuestionTool(pi: ExtensionAPI): void {
	let awaitingAnswer = false;
	const OptionSchema = Type.Object({
		label: Type.String({ description: "Display label for the option" }),
		description: Type.Optional(Type.String({ description: "Optional description shown below label" })),
	});

	pi.registerTool({
		executionMode: "sequential",
		name: "ask_user_question",
		label: "Ask User Question",
		description:
			"Ask the user a structured question with selectable options. Use when you need user input to proceed — choosing between approaches, confirming scope, resolving ambiguities. The user can also type a custom answer.",
		promptSnippet: "Ask the user a structured question when requirements are ambiguous",
		promptGuidelines: [
			"Use the ask_user_question tool whenever the user's request is underspecified and you cannot proceed without a concrete decision.",
			"Prefer ask_user_question over prose 'please tell me X' — the structured selector gives the user concrete options and records their choice in session history.",
			"This replaces the AskUserQuestion tool from Claude Code. The user can always pick 'Other (type your own answer)' for free-text input.",
			"Set multiSelect: true when several options may apply simultaneously; Other and Chat are exclusive alternative answers.",
		],
		parameters: Type.Object({
			question: Type.String({ description: "The question to ask the user" }),
			header: Type.Optional(Type.String({ description: "Section header for the question" })),
			options: Type.Array(OptionSchema, { description: "Options for the user to choose from" }),
			multiSelect: Type.Optional(
				Type.Boolean({ description: "Allow multiple selections. Default: false", default: false }),
			),
		}),

		async execute(_toolCallId, params, signal, _onUpdate, ctx) {
			if (signal?.aborted) return buildToolResult("Question cancelled", { question: params.question, answer: null });
			if (!ctx.hasUI || ctx.mode !== "tui") return { ...buildToolResult(ERROR_NO_UI, { question: params.question, answer: null }), isError: true };
			if (params.options.length === 0) return { ...buildToolResult(ERROR_NO_OPTIONS, { question: params.question, answer: null }), isError: true };
			if (awaitingAnswer) throw new Error("A question is already awaiting an answer; concurrent calls are not supported.");
			awaitingAnswer = true;
			try {

			const mainItems = buildMainItems(params.options);
			const chatItems: WrappingSelectItem[] = [{ label: CHAT_ABOUT_THIS_LABEL, isChat: true }];
			const totalCount = mainItems.length + chatItems.length;

			let removeAbort = () => {};
			let choice: (WrappingSelectItem & { selectedIndices?: number[] }) | null;
			try {
			choice = await ctx.ui.custom<WrappingSelectItem & { selectedIndices?: number[] } | null>((tui, theme, _kb, done) => {
				let finished = false;
				const finish = (value: (WrappingSelectItem & { selectedIndices?: number[] }) | null) => {
					if (finished) return;
					finished = true;
					done(value);
				};
				const abort = () => finish(null);
				signal?.addEventListener("abort", abort, { once: true });
				removeAbort = () => signal?.removeEventListener("abort", abort);
				if (signal?.aborted) abort();
				const checked = new Set<number>();
				const selectTheme: WrappingSelectTheme = {
					selectedText: (t) => theme.fg("accent", theme.bold(t)),
					description: (t) => theme.fg("muted", t),
					scrollInfo: (t) => theme.fg("dim", t),
				};

				const mainList = new WrappingSelect(
					mainItems,
					Math.min(mainItems.length, MAX_VISIBLE_ROWS),
					selectTheme,
					{ totalItemsForNumbering: totalCount },
				);
				const chatList = new WrappingSelect(chatItems, 1, selectTheme, {
					numberStartOffset: mainItems.length,
					totalItemsForNumbering: totalCount,
				});
				const editor = new Editor(tui, {
					borderColor: (s) => theme.fg("muted", s),
					selectList: {
						selectedPrefix: (s) => theme.fg("accent", s),
						selectedText: (s) => theme.fg("accent", s),
						description: (s) => theme.fg("muted", s),
						scrollInfo: (s) => theme.fg("dim", s),
						noMatch: (s) => theme.fg("warning", s),
					},
				});
				// The outer questionnaire owns Enter/submit semantics. Keeping submit
				// disabled lets this headless editor handle only text editing, including
				// bracketed paste and cursor movement.
				editor.disableSubmit = true;

				let selectionIndex = 0;
				const syncInputView = () => {
					const cursor = editor.getCursor();
					const lines = editor.getLines();
					let cursorOffset = cursor.col;
					for (let i = 0; i < cursor.line; i++) cursorOffset += (lines[i]?.length ?? 0) + 1;
					mainList.setInputBuffer(editor.getText(), cursorOffset);
				};
				const applySelection = () => {
					const isInMainList = selectionIndex < mainItems.length;
					mainList.setFocused(isInMainList);
					chatList.setFocused(!isInMainList);
					if (isInMainList) {
						mainList.setSelectedIndex(selectionIndex);
						if (mainItems[selectionIndex]?.isOther) syncInputView();
					} else {
						chatList.setSelectedIndex(selectionIndex - mainItems.length);
					}
				};
				applySelection();

				const container = buildDialogContainer(theme, params, mainList, chatList);
				if (params.multiSelect) mainList.setCheckedIndices(checked);

				return {
					render: (w) => container.render(w),
					invalidate: () => container.invalidate(),
					handleInput: (data) => {
						if (finished) return;
						const currentItem = itemAt(selectionIndex, mainItems, chatItems);
						const isInlineInputActive = !!currentItem?.isOther;
						const kb = getKeybindings();

						if (kb.matches(data, KEYBIND_UP)) {
							selectionIndex = wrapIndex(selectionIndex - 1, totalCount);
							applySelection();
							tui.requestRender();
							return;
						}
						if (kb.matches(data, KEYBIND_DOWN)) {
							selectionIndex = wrapIndex(selectionIndex + 1, totalCount);
							applySelection();
							tui.requestRender();
							return;
						}
						if (params.multiSelect && !isInlineInputActive && selectionIndex < params.options.length && matchesKey(data, "space")) {
							if (checked.has(selectionIndex)) checked.delete(selectionIndex); else checked.add(selectionIndex);
							mainList.setCheckedIndices(checked);
							tui.requestRender();
							return;
						}
						if (kb.matches(data, KEYBIND_CONFIRM)) {
							if (isInlineInputActive) {
								finish({ label: editor.getExpandedText?.() ?? editor.getText(), isOther: true });
							} else if (currentItem?.isChat) {
								finish(currentItem);
							} else if (params.multiSelect) {
								if (!checked.size) { ctx.ui.notify("Select at least one option with Space, or choose a custom answer or chat.", "warning"); return; }
								const selectedIndices = [...checked].sort((a, b) => a - b);
								finish({ label: selectedIndices.map(i => params.options[i].label).join("\n"), selectedIndices });
							} else if (currentItem) {
								finish(currentItem);
							}
							return;
						}
						if (kb.matches(data, KEYBIND_CANCEL)) {
							finish(null);
							return;
						}
						if (isInlineInputActive) {
							editor.handleInput(data);
							syncInputView();
							tui.requestRender();
						}
					},
				};
			});
			} finally { removeAbort(); }

			if (signal?.aborted) return buildToolResult("Question cancelled", { question: params.question, answer: null });
			return buildResponse(choice, params);
			} finally { awaitingAnswer = false; }
		},
	});
}

function buildMainItems(options: QuestionOption[]): WrappingSelectItem[] {
	return [
		...options.map((o) => ({ label: o.label, description: o.description })),
		{ label: TYPE_SOMETHING_LABEL, isOther: true },
	];
}

function itemAt(
	index: number,
	mainItems: WrappingSelectItem[],
	chatItems: WrappingSelectItem[],
): WrappingSelectItem | undefined {
	return index < mainItems.length ? mainItems[index] : chatItems[index - mainItems.length];
}

function wrapIndex(index: number, total: number): number {
	return ((index % total) + total) % total;
}

function buildDialogContainer(
	theme: Theme,
	params: QuestionParams,
	mainList: WrappingSelect,
	chatList: WrappingSelect,
): Container {
	const container = new Container();
	const border = () => new DynamicBorder((s: string) => theme.fg("accent", s));

	container.addChild(border());
	container.addChild(new Spacer(1));
	if (params.header) {
		container.addChild(new Text(theme.bg("selectedBg", ` ${params.header} `), 1, 0));
		container.addChild(new Spacer(1));
	}
	container.addChild(new Text(theme.bold(params.question), 1, 0));
	container.addChild(new Spacer(1));
	container.addChild(mainList);
	container.addChild(new Spacer(1));
	container.addChild(border());
	container.addChild(chatList);
	container.addChild(new Spacer(1));
	container.addChild(new Text(theme.fg("dim", params.multiSelect ? "Space to toggle · Enter to submit checked options · ↑/↓ to navigate · Esc to cancel · Other/Chat are exclusive" : NAV_HINT), 1, 0));
	return container;
}

function buildResponse(choice: (WrappingSelectItem & { selectedIndices?: number[] }) | null, params: QuestionParams) {
	if (!choice) {
		return buildToolResult(DECLINE_MESSAGE, { question: params.question, answer: null });
	}
	if (choice.isOther) {
		const customAnswer = choice.label.length > 0 ? choice.label : null;
		return buildToolResult(
			`User answered: ${customAnswer ?? NO_INPUT_PLACEHOLDER}`,
			{ question: params.question, answer: customAnswer, wasCustom: true },
		);
	}
	if (choice.isChat) {
		return buildToolResult(CHAT_CONTINUATION_MESSAGE, {
			question: params.question,
			answer: CHAT_ANSWER_TAG,
			wasChat: true,
		});
	}
	if (choice.selectedIndices) {
		const answers = choice.selectedIndices.map(i => params.options[i].label);
		return buildToolResult(`User selected multiple options:\n${answers.map(x => `- ${x}`).join("\n")}`, {
			question: params.question, answer: choice.label, answers,
			selectedIndices: choice.selectedIndices, multiSelect: true, wasCustom: false,
		});
	}
	return buildToolResult(`User selected: ${choice.label}`, {
		question: params.question,
		answer: choice.label,
		wasCustom: false,
	});
}

function buildToolResult(text: string, details: ToolDetails) {
	return {
		content: [{ type: "text" as const, text }],
		details,
	};
}
