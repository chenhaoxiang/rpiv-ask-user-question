import { types } from "node:util";

interface QuestionOption {
	label: string;
	description?: string;
}

export interface QuestionParams {
	question: string;
	header?: string;
	options: QuestionOption[];
	multiSelect?: boolean;
	workRef?: unknown;
	stageId?: unknown;
}

const ACCESSOR = Symbol("accessor argument");
const normalizeLineEndings = (text: string) => text.replace(/\r\n?/gu, "\n");

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === "object" && !types.isProxy(value) && !Array.isArray(value);
}

function ownValue(value: Record<string, unknown>, key: string): unknown {
	const descriptor = Object.getOwnPropertyDescriptor(value, key);
	return descriptor ? (Object.hasOwn(descriptor, "value") ? descriptor.value : ACCESSOR) : undefined;
}

function parseJson(value: string): unknown {
	try { return JSON.parse(value) as unknown; } catch { return undefined; }
}

export function normalizeQuestionArguments(raw: unknown): QuestionParams | undefined {
	const encoded = typeof raw === "string";
	const args = encoded ? parseJson(raw) : raw;
	if (!isRecord(args)) return undefined;

	// Decode only where a string cannot already be valid, and at most one
	// layer per call. JSON-looking question/option text remains literal.
	const question = ownValue(args, "question");
	const header = ownValue(args, "header");
	const rawOptions = ownValue(args, "options");
	const items = !encoded && typeof rawOptions === "string" ? parseJson(rawOptions) : rawOptions;
	const multiSelect = ownValue(args, "multiSelect");
	if (typeof question !== "string" || (header !== undefined && typeof header !== "string")
		|| types.isProxy(items) || !Array.isArray(items)
		|| (multiSelect !== undefined && typeof multiSelect !== "boolean")) return undefined;

	const options: QuestionOption[] = [];
	for (let index = 0; index < items.length; index++) {
		const option = Object.getOwnPropertyDescriptor(items, index)?.value;
		if (!isRecord(option)) return undefined;
		const label = ownValue(option, "label");
		const description = ownValue(option, "description");
		if (typeof label !== "string" || (description !== undefined && typeof description !== "string")) return undefined;
		options.push(description === undefined
			? { label: normalizeLineEndings(label) }
			: { label: normalizeLineEndings(label), description: normalizeLineEndings(description) });
	}

	const workRef = ownValue(args, "workRef"), stageId = ownValue(args, "stageId");
	return {
		question: normalizeLineEndings(question),
		options,
		...(header === undefined ? {} : { header: normalizeLineEndings(header) }),
		...(multiSelect === undefined ? {} : { multiSelect }),
		// Accessors stay unavailable to the optional observer without being read.
		...(workRef === undefined ? {} : { workRef: workRef === ACCESSOR ? null : workRef }),
		...(stageId === undefined ? {} : { stageId: stageId === ACCESSOR ? null : stageId }),
	};
}

export function readQuestionText(raw: unknown): string {
	const value = isRecord(raw) ? ownValue(raw, "question") : undefined;
	return typeof value === "string" ? normalizeLineEndings(value) : "";
}
