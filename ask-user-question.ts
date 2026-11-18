import { type ExtensionAPI, type ExtensionContext, DynamicBorder, type Theme } from "@earendil-works/pi-coding-agent";
import { Editor, getKeybindings, matchesKey, truncateToWidth, visibleWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { normalizeQuestionArguments, readQuestionText, type QuestionParams } from "./question-arguments.js";
import { askRpcQuestion } from "./rpc-question.js";
import { createWorkQuestionObserver, getNativeSessionId, type WorkQuestionCloseReason } from "./work-question-observer.js";
import {
	WrappingSelect,
	type WrappingSelectItem,
	type WrappingSelectTheme,
} from "./wrapping-select.js";

export type { QuestionParams } from "./question-arguments.js";

const MAX_VISIBLE_ITEMS = 10;

const TYPE_SOMETHING_LABEL = "Type something.";
const CHAT_ABOUT_THIS_LABEL = "Chat about this";
const NAV_HINT = "Enter to select · ↑/↓ to navigate · Esc to cancel";

const DECLINE_MESSAGE = "User declined to answer questions";
const CHAT_CONTINUATION_MESSAGE = "User wants to chat about this. Continue the conversation to help them decide.";
const CHAT_ANSWER_TAG = "User wants to chat about this";
const NO_INPUT_PLACEHOLDER = "(no input)";
const ERROR_NO_UI = "Error: UI not available (running in non-interactive mode)";
const ERROR_NO_OPTIONS = "Error: No options provided";
const ERROR_INVALID_ARGUMENTS = "Error: Invalid question arguments";
const CONCURRENT_QUESTION = "A question is already awaiting an answer; concurrent calls are not supported.";

const KEYBIND_UP = "tui.select.up";
const KEYBIND_DOWN = "tui.select.down";
const KEYBIND_CONFIRM = "tui.select.confirm";
const KEYBIND_CANCEL = "tui.select.cancel";

type QuestionChoice = (WrappingSelectItem & { selectedIndices?: number[] }) | null;
type QuestionObservation = ReturnType<ReturnType<typeof createWorkQuestionObserver>["begin"]>;

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
	const awaitingQuestions = new Set<string | object>();
	const workQuestions = createWorkQuestionObserver(pi);
	const OptionSchema = Type.Object({
		label: Type.String({ description: "Display label for the option" }),
		description: Type.Optional(Type.String({ description: "Optional description shown below label" })),
	});

	pi.registerTool({
		executionMode: "sequential",
		exposure: "model-only",
		prepareArguments(args) {
			const params = normalizeQuestionArguments(args);
			if (!params) throw new Error(ERROR_INVALID_ARGUMENTS);
			return params;
		},
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
			"Only pass ask_user_question workRef/stageId for an existing owner record already established in this task. Omit uncertain metadata; do not infer work from cwd, session titles or owner labels.",
		],
		parameters: Type.Object({
			question: Type.String({ description: "The question to ask the user" }),
			header: Type.Optional(Type.String({ description: "Section header for the question" })),
			options: Type.Array(OptionSchema, { description: "Options for the user to choose from" }),
			multiSelect: Type.Optional(
				Type.Boolean({ description: "Allow multiple selections. Default: false", default: false }),
			),
			workRef: Type.Optional(Type.Unknown({ description: "Optional existing PiWorkRef {owner, kind: issue|change|task|document, key}. Observation-only caller declaration; omit if unknown. Invalid metadata does not block the question." })),
			stageId: Type.Optional(Type.Unknown({ description: "Optional opaque work stage/phase with workRef. Observation only, not authorization or proof that a decision was applied." })),
		}),

		async execute(toolCallId, rawParams, signal, _onUpdate, ctx) {
			const params = normalizeQuestionArguments(rawParams);
			const question = params?.question ?? readQuestionText(rawParams);
			if (signal?.aborted) return buildToolResult("Question cancelled", { question, answer: null });
			if (!params) return { ...buildToolResult(ERROR_INVALID_ARGUMENTS, { question, answer: null }), isError: true };
			const ui = ctx.ui;
			const rpcUi = ctx.mode === "rpc" && typeof ui.select === "function" && typeof ui.input === "function";
			if (!ctx.hasUI || (ctx.mode !== "tui" && !rpcUi)) return { ...buildToolResult(ERROR_NO_UI, { question, answer: null }), isError: true };
			if (params.options.length === 0) return { ...buildToolResult(ERROR_NO_OPTIONS, { question, answer: null }), isError: true };

			// Without a safe native id, use the exact standalone context;
			// never guess from a shared session manager, UI, path, or display name.
			const guardKey = getNativeSessionId(ctx) ?? ctx;
			if (awaitingQuestions.has(guardKey)) throw new Error(CONCURRENT_QUESTION);
			awaitingQuestions.add(guardKey);
			let closeReason: WorkQuestionCloseReason = "error";
			let observation: QuestionObservation = undefined;
			try {
				observation = rpcUi ? undefined : workQuestions.begin(toolCallId, params, ctx);
				const choice = rpcUi
					? await askRpcQuestion(params, ui, signal)
					: await askTuiQuestion(pi, toolCallId, params, ui, signal, observation);
				if (signal?.aborted) {
					closeReason = "aborted";
					return buildToolResult("Question cancelled", { question, answer: null });
				}
				const result = buildResponse(choice, params);
				closeReason = result.details.wasChat ? "chat" : result.details.answer === null ? result.details.wasCustom ? "empty" : "declined" : "answered";
				if (closeReason === "answered") observation?.answerReceived();
				return result;
			} finally {
				awaitingQuestions.delete(guardKey);
				observation?.closed(closeReason);
			}
		},
	});
}

async function askTuiQuestion(
	pi: ExtensionAPI,
	toolCallId: string,
	params: QuestionParams,
	ui: ExtensionContext["ui"],
	signal: AbortSignal | undefined,
	observation: QuestionObservation,
): Promise<QuestionChoice> {
	const mainItems = buildMainItems(params.options);
	const chatItems: WrappingSelectItem[] = [{ label: CHAT_ABOUT_THIS_LABEL, isChat: true }];
	const totalCount = mainItems.length + chatItems.length;
	let finished = false;
	let notified = false;
	let finish: ((choice: QuestionChoice) => void) | undefined;
	let abort: (() => void) | undefined;
	const emitInput = (phase: "start" | "end") => {
		try { pi.events?.emit("pi:input-required", { version: 1, source: "ask_user_question", id: toolCallId, phase }); }
		catch { /* Optional observers must never change the question result. */ }
	};
	try {
		return await new Promise<QuestionChoice>((resolve, reject) => {
			abort = () => {
				finish?.(null);
				finished = true;
				resolve(null);
			};
			signal?.addEventListener("abort", abort, { once: true });
			if (signal?.aborted) { abort(); return; }

			ui.custom<QuestionChoice>((tui, theme, _kb, done) => {
				// A delayed factory or input callback cannot reopen a settled call.
				if (finished || notified) return { render: () => [], invalidate: () => {} };
				const complete = (value: QuestionChoice) => {
					if (finished) return;
					finished = true;
					try { done(value); } catch (error) { reject(error); }
				};
				finish = complete;
				notified = true;
				emitInput("start");
				observation?.opened();
				const checked = new Set<number>();
				const selectTheme: WrappingSelectTheme = {
					selectedText: (t) => theme.fg("accent", theme.bold(t)),
					description: (t) => theme.fg("muted", t),
					scrollInfo: (t) => theme.fg("dim", t),
				};

				const mainList = new WrappingSelect(
					mainItems,
					Math.min(mainItems.length, MAX_VISIBLE_ITEMS),
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

				const render = buildDialog(theme, params, mainList, chatList);
				if (params.multiSelect) mainList.setCheckedIndices(checked);

				const handleInput = (data: string) => {
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
							complete({ label: editor.getExpandedText?.() ?? editor.getText(), isOther: true });
						} else if (currentItem?.isChat) {
							complete(currentItem);
						} else if (params.multiSelect) {
							if (!checked.size) { ui.notify("Select at least one option with Space, or choose a custom answer or chat.", "warning"); return; }
							const selectedIndices = [...checked].sort((a, b) => a - b);
							complete({ label: selectedIndices.map(i => params.options[i].label).join("\n"), selectedIndices });
						} else if (currentItem) {
							complete(currentItem);
						}
						return;
					}
					if (kb.matches(data, KEYBIND_CANCEL)) {
						complete(null);
						return;
					}
					if (isInlineInputActive) {
						editor.handleInput(data);
						syncInputView();
						tui.requestRender();
					}
				};
				const fail = (error: unknown) => {
					reject(error);
					complete(null);
				};
				return {
					render: (width) => {
						if (finished) return [];
						try { return render(width, tui.terminal?.rows, selectionIndex >= mainItems.length); }
						catch (error) { fail(error); return []; }
					},
					invalidate: () => {},
					handleInput: (data) => {
						if (finished) return;
						try { handleInput(data); } catch (error) { fail(error); }
					},
				};
			}).then(resolve, reject);
		});
	} finally {
		finished = true;
		if (abort) signal?.removeEventListener("abort", abort);
		if (notified) emitInput("end");
	}
}

function buildMainItems(options: QuestionParams["options"]): WrappingSelectItem[] {
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

function buildDialog(theme: Theme, params: QuestionParams, mainList: WrappingSelect, chatList: WrappingSelect) {
	const border = new DynamicBorder((s: string) => theme.fg("accent", s));
	const instructions = params.multiSelect
		? ["Space to toggle · Enter to submit checked options · ↑/↓ to navigate · Esc to cancel · Other/Chat are exclusive", "↑↓ Spc Enter Esc", "Spc ↵ Esc"]
		: [NAV_HINT, "↑↓ Enter Esc", "Enter Esc", "↵ Esc"];
	return (width: number, terminalRows: number | undefined, chatFocused: boolean): string[] => {
		if (width < 1) return [];
		// Leave room for Pi's own status/footer around the editor slot. On very
		// short screens drop decoration first, then the unfocused option group.
		const rows = terminalRows && Number.isFinite(terminalRows) && terminalRows > 0 ? Math.floor(terminalRows) : 24;
		const budget = Math.max(Math.min(rows, 2), rows - 4);
		const hint = instructions.find(text => visibleWidth(text) <= width) ?? instructions[instructions.length - 1];
		const footer = theme.fg("dim", truncateToWidth(hint, width, ""));
		if (budget === 1) return [footer];

		const showMain = budget >= 4 || !chatFocused;
		const showChat = budget >= 4 || chatFocused;
		const textBudget = budget - 1 - Number(showMain) - Number(showChat);
		const wrap = (text: string, limit: number, style: (line: string) => string) => {
			if (limit < 1) return [];
			const lines = wrapTextWithAnsi(text, width);
			if (lines.length > limit) lines[limit - 1] += "…";
			return lines.slice(0, limit).map(line => style(truncateToWidth(line, width, "…")));
		};
		const question = wrap(params.question, Math.min(3, Math.ceil(textBudget / 2)), line => theme.bold(line));
		const header = params.header ? wrap(params.header, Math.min(2, Math.floor(textBudget / 2)), line => theme.bg("selectedBg", line)) : [];
		const borders = budget >= 12 ? border.render(width) : [];
		const listBudget = budget - header.length - question.length - borders.length * 2 - 1;
		const chat = showChat ? chatList.render(width, Math.min(2, listBudget - Number(showMain))) : [];
		const main = showMain ? mainList.render(width, listBudget - chat.length) : [];
		return [...borders, ...header, ...question, ...main, ...borders, ...chat, footer];
	};
}

function buildResponse(choice: QuestionChoice, params: QuestionParams) {
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
