import test from 'node:test';
import assert from 'node:assert/strict';
import { KeybindingsManager, TUI_KEYBINDINGS, setKeybindings } from '@earendil-works/pi-tui';
import { questionHarness } from './helpers/source-vm.mjs';

const options = labels => ({ question: 'Choose', options: labels.map(label => ({ label })) });
const multiOptions = labels => ({ ...options(labels), multiSelect: true });
const plain = value => JSON.parse(JSON.stringify(value));

async function resultFor(params, keys) {
  const h = await questionHarness();
  const pending = h.tool.execute('keyboard', params, undefined, undefined, h.ctx);
  for (const key of keys) h.component.handleInput(key);
  return { h, result: await pending };
}

test('single-select digit answers the option at that index', async () => {
  const { result } = await resultFor(options(['A', 'B', 'C']), ['2']);
  assert.equal(result.details.answer, 'B');
  assert.equal(result.details.wasCustom, false);
});

test('multi-select digits toggle option indexes, including 1 and 9', async () => {
  const labels = Array.from({ length: 9 }, (_, index) => `Option ${index + 1}`);
  const { result } = await resultFor(multiOptions(labels), ['1', '9', '\r']);
  assert.deepEqual(plain(result.details.selectedIndices), [0, 8]);
  assert.deepEqual(plain(result.details.answers), ['Option 1', 'Option 9']);
});

test('multi-digit input is not treated as an option shortcut', async () => {
  const h = await questionHarness();
  const pending = h.tool.execute('keyboard-multi-digit', options(['A', 'B']), undefined, undefined, h.ctx);
  h.component.handleInput('12');
  h.component.handleInput('\r');
  assert.equal((await pending).details.answer, 'A');
});

test('digits beyond the option list do not select Other or Chat', async () => {
  const { result } = await resultFor(options(['A', 'B']), ['3', '\r']);
  assert.equal(result.details.answer, 'A');
  assert.equal(result.details.wasCustom, false);
});

test('numeric text remains editable on the Other row', async () => {
  const h = await questionHarness();
  const pending = h.tool.execute('keyboard-other', options(['A', 'B']), undefined, undefined, h.ctx);
  h.component.handleInput('\x1b[B');
  h.component.handleInput('\x1b[B');
  h.component.handleInput('123');
  h.component.handleInput('\r');
  const result = await pending;
  assert.equal(result.details.answer, '123');
  assert.equal(result.details.wasCustom, true);
});

test('CSI-u Space toggles multi-select like ordinary Space', async () => {
  const { result } = await resultFor(multiOptions(['A', 'B']), ['\x1b[32u', '\r']);
  assert.deepEqual(plain(result.details.selectedIndices), [0]);
  assert.deepEqual(plain(result.details.answers), ['A']);
});

test('modified digit and Space sequences do not activate shortcuts', async () => {
  const h = await questionHarness();
  const pending = h.tool.execute('keyboard-modifiers', multiOptions(['A', 'B']), undefined, undefined, h.ctx);
  h.component.handleInput('\x1b[49;2u'); // Shift+1
  h.component.handleInput('\x1b[49;3u'); // Alt+1
  h.component.handleInput('\x1b[49;5u'); // Ctrl+1
  h.component.handleInput('\x1b[32;2u'); // Shift+Space
  h.component.handleInput('\x1b[32;3u'); // Alt+Space
  h.component.handleInput('\x1b[32;5u'); // Ctrl+Space
  h.component.handleInput('\r');
  assert.equal(h.notices.length, 1);
  h.component.handleInput('\x1b');
  assert.equal((await pending).details.answer, null);
});

test('a digit assigned to a Pi keybinding keeps that binding', async () => {
  const original = new KeybindingsManager(TUI_KEYBINDINGS);
  setKeybindings(new KeybindingsManager(TUI_KEYBINDINGS, { 'tui.select.down': '1' }));
  try {
    const { result } = await resultFor(options(['A', 'B']), ['1', '\r']);
    assert.equal(result.details.answer, 'B');
  } finally {
    setKeybindings(original);
  }
});

test('duplicate labels remain index-distinct for numeric multi-select', async () => {
  const { result } = await resultFor(multiOptions(['same', 'same', 'last']), ['2', '3', '\r']);
  assert.deepEqual(plain(result.details.selectedIndices), [1, 2]);
  assert.deepEqual(plain(result.details.answers), ['same', 'last']);
});

test('abort still fences late keyboard callbacks after numeric handling', async () => {
  const h = await questionHarness();
  const abort = new AbortController();
  const pending = h.tool.execute('keyboard-abort', multiOptions(['A', 'B']), abort.signal, undefined, h.ctx);
  abort.abort();
  h.component.handleInput('2');
  h.component.handleInput('\x1b[32u');
  h.component.handleInput('\r');
  const result = await pending;
  assert.equal(result.details.answer, null);
});
