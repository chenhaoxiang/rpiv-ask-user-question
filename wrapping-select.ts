import { visibleWidth, wrapTextWithAnsi, truncateToWidth } from "@earendil-works/pi-tui";
import type { Component } from "@earendil-works/pi-tui";
import { renderInlineInputRow as renderInlineInput } from "./inline-input.js";

export interface WrappingSelectItem {
	label: string;
	description?: string;
	/** Sentinel: the inline free-text input row. */
	isOther?: boolean;
	/** Sentinel: the "chat about this question" row. */
	isChat?: boolean;
}

export interface WrappingSelectTheme {
	selectedText: (text: string) => string;
	description: (text: string) => string;
	scrollInfo: (text: string) => string;
}

export interface WrappingSelectOptions {
	/** Start numbering at this offset + 1 (default 0 → rows labeled 1, 2, 3 …). */
	numberStartOffset?: number;
	/** Override the total used to pad the number column (useful when items span multiple lists). */
	totalItemsForNumbering?: number;
}

export class WrappingSelect implements Component {
	private static readonly ACTIVE_POINTER = "❯ ";
	private static readonly INACTIVE_POINTER = "  ";
	private static readonly NUMBER_SEPARATOR = ". ";
	private static readonly MIN_CONTENT_WIDTH = 1;

	private readonly items: readonly WrappingSelectItem[];
	private readonly maxVisible: number;
	private readonly theme: WrappingSelectTheme;
	private readonly numberStartOffset: number;
	private readonly totalItemsForNumbering: number;

	private selectedIndex = 0;
	private checkedIndices: ReadonlySet<number> | undefined;

	setCheckedIndices(indices: ReadonlySet<number>): void {
		this.checkedIndices = new Set(indices);
	}
	private focused = true;
	private inputBuffer = "";
	private inputCursorOffset: number | undefined = undefined;

	constructor(
		items: readonly WrappingSelectItem[],
		maxVisible: number,
		theme: WrappingSelectTheme,
		options: WrappingSelectOptions = {},
	) {
		this.items = items;
		this.maxVisible = Math.max(1, maxVisible);
		this.theme = theme;
		this.numberStartOffset = options.numberStartOffset ?? 0;
		this.totalItemsForNumbering = options.totalItemsForNumbering ?? items.length;
	}

	setSelectedIndex(index: number): void {
		this.selectedIndex = Math.max(0, Math.min(index, this.items.length - 1));
	}

	setFocused(focused: boolean): void {
		this.focused = focused;
	}

	getInputBuffer(): string {
		return this.inputBuffer;
	}

	setInputBuffer(text: string, cursorOffset?: number): void {
		this.inputBuffer = text;
		this.inputCursorOffset = cursorOffset;
	}

	setInputCursorOffset(offset: number | undefined): void {
		this.inputCursorOffset = offset;
	}

	appendInput(text: string): void {
		const printable = this.stripControlChars(text);
		if (printable) this.inputBuffer += printable;
	}

	backspaceInput(): void {
		if (this.inputBuffer.length === 0) return;
		this.inputBuffer = Array.from(this.inputBuffer).slice(0, -1).join("");
	}

	clearInputBuffer(): void {
		this.inputBuffer = "";
		this.inputCursorOffset = undefined;
	}

	/** Intentionally empty — input is routed at the container level. */
	handleInput(_data: string): void {}

	invalidate(): void {}

	render(width: number, maxRows = Infinity): string[] {
		if (this.items.length === 0 || maxRows < 1) return [];

		const half = Math.floor(this.maxVisible / 2);
		const start = Math.max(0, Math.min(this.selectedIndex - half, this.items.length - this.maxVisible));
		const end = Math.min(start + this.maxVisible, this.items.length);
		const numberWidth = String(this.totalItemsForNumbering).length;
		const render = (index: number, budget: number) => this.renderItem(index, width, numberWidth, budget);

		// Start with the focused item, then grow a contiguous window around it.
		// A long description in a neighboring item cannot push the focus away.
		let first = this.selectedIndex, last = this.selectedIndex;
		const selected = render(this.selectedIndex, maxRows);
		let remaining = maxRows - selected.length;
		const before: string[][] = [], after: string[][] = [];
		while (remaining > 0 && (first > start || last + 1 < end)) {
			const takeNext = last + 1 < end && (first === start || last - this.selectedIndex <= this.selectedIndex - first);
			const rows = takeNext ? render(++last, remaining) : render(--first, remaining);
			(takeNext ? after : before).push(rows);
			remaining -= rows.length;
		}
		const lines = [...before.reverse().flat(), ...selected, ...after.flat()];
		if (remaining > 0 && (first > 0 || last + 1 < this.items.length)) {
			lines.push(this.theme.scrollInfo(`  (${this.selectedIndex + 1}/${this.items.length})`));
		}
		return lines.map(line => truncateToWidth(line, width, ""));
	}

	private renderItem(index: number, width: number, numberWidth: number, maxRows: number): string[] {
		const item = this.items[index];
		const isActive = index === this.selectedIndex && this.focused;
		const prefix = this.buildRowPrefix(index, isActive, numberWidth);
		// Keep the focus pointer and some label text even if the full ordinal and
		// checkbox prefix do not fit. The unabridged prefix returns on resize.
		const rowPrefix = visibleWidth(prefix) + 2 <= width ? prefix : isActive ? "❯" : " ";
		const continuationPrefix = " ".repeat(visibleWidth(rowPrefix));
		const contentWidth = Math.max(WrappingSelect.MIN_CONTENT_WIDTH, width - visibleWidth(rowPrefix));

		if (this.shouldRenderAsInlineInput(item, isActive)) {
			return this.renderInlineInputRow(rowPrefix, continuationPrefix, contentWidth, maxRows);
		}

		const label = this.renderLabelBlock(item.label, rowPrefix, continuationPrefix, contentWidth, isActive);
		const lines = label.length >= maxRows
			? label
			: [...label, ...this.renderDescriptionBlock(item.description, continuationPrefix, contentWidth)];
		const visible = lines.slice(0, maxRows);
		if (lines.length > maxRows || (label.length >= maxRows && item.description)) {
			const last = visible.length - 1;
			// Do not let the ellipsis replace the focus pointer at width one.
			if (width > 1) visible[last] = truncateToWidth(visible[last] + "…", width, "…");
		}
		return visible;
	}

	private buildRowPrefix(index: number, isActive: boolean, numberWidth: number): string {
		const pointer = isActive ? WrappingSelect.ACTIVE_POINTER : WrappingSelect.INACTIVE_POINTER;
		const displayNumber = this.numberStartOffset + index + 1;
		const paddedNumber = String(displayNumber).padStart(numberWidth, " ");
		const item = this.items[index];
		const checkbox = this.checkedIndices && !item?.isOther && !item?.isChat
			? (this.checkedIndices.has(index) ? "[x] " : "[ ] ") : "";
		return `${pointer}${paddedNumber}${WrappingSelect.NUMBER_SEPARATOR}${checkbox}`;
	}

	private shouldRenderAsInlineInput(item: WrappingSelectItem, isActive: boolean): boolean {
		return !!item.isOther && isActive;
	}

	private renderInlineInputRow(rowPrefix: string, continuationPrefix: string, contentWidth: number, maxRows: number): string[] {
		return renderInlineInput({
			buffer: this.inputBuffer,
			cursorOffset: this.inputCursorOffset,
			rowPrefix,
			continuationPrefix,
			contentWidth,
			maxRows,
			selectedText: this.theme.selectedText,
		});
	}

	private renderLabelBlock(
		label: string,
		rowPrefix: string,
		continuationPrefix: string,
		contentWidth: number,
		isActive: boolean,
	): string[] {
		const wrapped = wrapTextWithAnsi(label, contentWidth);
		return wrapped.map((segment, index) => {
			const prefix = index === 0 ? rowPrefix : continuationPrefix;
			const line = `${prefix}${segment}`;
			return isActive ? this.theme.selectedText(line) : line;
		});
	}

	private renderDescriptionBlock(
		description: string | undefined,
		continuationPrefix: string,
		contentWidth: number,
	): string[] {
		if (!description) return [];
		const wrapped = wrapTextWithAnsi(description, contentWidth);
		return wrapped.map((segment) => `${continuationPrefix}${this.theme.description(segment)}`);
	}

	private stripControlChars(text: string): string {
		return Array.from(text).filter((c) => c >= " ").join("");
	}
}
