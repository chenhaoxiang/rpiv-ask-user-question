import type { ExtensionUIContext } from "@earendil-works/pi-coding-agent";
import type { QuestionParams } from "./ask-user-question.js";
import type { WrappingSelectItem } from "./wrapping-select.js";

type Choice = (WrappingSelectItem & { selectedIndices?: number[] }) | null;
const OTHER = "[Other] Type something.";
const CHAT = "[Chat] Chat about this";
const SUBMIT = "[Submit] Submit checked options";

/** Public RPC dialogs only: custom terminal components cannot cross RPC. */
export async function askRpcQuestion(
	params: QuestionParams,
	ui: Pick<ExtensionUIContext, "select" | "input" | "notify">,
	signal?: AbortSignal,
): Promise<Choice> {
	const checked = new Set<number>();
	const title = [params.header, params.question].filter(Boolean).join("\n\n");
	const wait = async <T>(invoke: () => Promise<T>): Promise<T | undefined> => {
		if (signal?.aborted) return undefined;
		let remove = () => {};
		try {
			const aborted = new Promise<undefined>(resolve => {
				const cancel = () => resolve(undefined);
				signal?.addEventListener("abort", cancel, { once: true });
				remove = () => signal?.removeEventListener("abort", cancel);
			});
			return await Promise.race([invoke(), aborted]);
		} finally { remove(); }
	};

	while (!signal?.aborted) {
		// Ordinal prefixes make duplicate labels unambiguous on the wire.
		const options = params.options.map((option, index) =>
			`${params.multiSelect ? `[${checked.has(index) ? "x" : " "}] ` : ""}${index + 1}. ${option.label}${option.description ? ` — ${option.description}` : ""}`,
		);
		const menu = [...options, ...(params.multiSelect ? [SUBMIT] : []), OTHER, CHAT];
		const selected = await wait(() => ui.select(title, menu, { signal }));
		if (signal?.aborted || selected === undefined) return null;
		if (selected === OTHER) {
			const text = await wait(() => ui.input(title, "Type your own answer", { signal }));
			return signal?.aborted || text === undefined ? null : { label: text, isOther: true };
		}
		if (selected === CHAT) return { label: "Chat about this", isChat: true };
		if (params.multiSelect && selected === SUBMIT) {
			if (!checked.size) {
				ui.notify("Select at least one option, or choose a custom answer or chat.", "warning");
				continue;
			}
			const selectedIndices = [...checked].sort((a, b) => a - b);
			return { label: selectedIndices.map(index => params.options[index].label).join("\n"), selectedIndices };
		}
		const index = options.indexOf(selected);
		if (index < 0) throw new Error("RPC host returned an unknown question option");
		if (!params.multiSelect) return { label: params.options[index].label };
		if (checked.has(index)) checked.delete(index); else checked.add(index);
	}
	return null;
}
