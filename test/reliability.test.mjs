import test from 'node:test';
import assert from 'node:assert/strict';
import { CURSOR_MARKER, visibleWidth } from '@earendil-works/pi-tui';
import { questionHarness, theme } from './helpers/source-vm.mjs';

const params = { question: 'Choose', options: [{ label: 'A' }, { label: 'B' }] };
const run = (h, id, input = params, signal, ctx = h.ctx) => h.tool.execute(id, input, signal, undefined, ctx);
const phases = h => h.events.filter(e => e.name === 'pi:input-required').map(e => [e.data.id, e.data.phase]);

// Calls use one tool registration; the contexts carry independent UI resources.
test('native session identity isolates RPC and TUI guards and releases only the finishing session', async () => {
  const h = await questionHarness({ sessionId: 'session-a' });
  let cancelRpc;
  const rpc = { mode: 'rpc', hasUI: true, sessionManager: { getSessionId: () => 'session-b' }, ui: {
    select: () => new Promise(resolve => { cancelRpc = resolve; }), input: async () => undefined,
  } };
  const tuiPending = run(h, 'tui');
  const rpcPending = run(h, 'rpc', params, undefined, rpc);
  await assert.rejects(run(h, 'same-native-id', params, undefined, {
    ...rpc, sessionManager: { getSessionId: () => 'session-a' },
  }), /already awaiting/);
  assert.equal(typeof cancelRpc, 'function');
  cancelRpc(undefined);
  assert.equal((await rpcPending).content[0].text, 'User declined to answer questions');
  await assert.rejects(run(h, 'still-busy'), /already awaiting/);

  rpc.ui.select = async () => { throw new Error('RPC host failed'); };
  await assert.rejects(run(h, 'rpc-error', params, undefined, rpc), /RPC host failed/);
  rpc.ui.select = async (_title, menu) => menu[1];
  assert.equal((await run(h, 'rpc-retry', params, undefined, rpc)).details.answer, 'B');
  h.component.handleInput('\x1b');
  assert.equal((await tuiPending).details.answer, null);
  const next = run(h, 'tui-retry');
  h.component.handleInput('\r');
  assert.equal((await next).details.answer, 'A');
});

for (const sessionId of [undefined, '../../unsafe-session', 'sk-xxxxxxxxxxxx', 'throwing']) {
  test(`unusable native id (${sessionId ?? 'missing'}) guards only the exact local UI`, async () => {
    const h = await questionHarness({ sessionId });
    if (sessionId === 'throwing') h.ctx.sessionManager.getSessionId = () => { throw Error('unavailable'); };
    const other = await questionHarness({ sessionId });
    if (sessionId === 'throwing') other.ctx.sessionManager.getSessionId = h.ctx.sessionManager.getSessionId;
    const first = run(h, 'first');
    const second = run(h, 'second', params, undefined, other.ctx);
    await assert.rejects(run(h, 'overlap', params, undefined, h.ctx), /already awaiting/);
    h.component.handleInput('\x1b');
    other.component.handleInput('\x1b[B');
    other.component.handleInput('\r');
    assert.equal((await first).details.answer, null);
    assert.equal((await second).details.answer, 'B');
  });
}

test('TUI abort before a delayed factory releases the guard without creating a late lifecycle interval', { timeout: 2000 }, async () => {
  const h = await questionHarness({ sessionId: 'session-a' });
  const custom = h.ctx.ui.custom;
  let oldFactory, lateReply, oldDoneCalls = 0;
  h.ctx.ui.custom = factory => new Promise(resolve => { oldFactory = factory; lateReply = resolve; });
  const abort = new AbortController();
  const pending = run(h, 'old', params, abort.signal);
  abort.abort();
  assert.equal((await pending).content[0].text, 'Question cancelled');
  assert.deepEqual(h.events, []);

  h.ctx.ui.custom = custom;
  const next = run(h, 'next');
  const stale = oldFactory({ requestRender() {} }, theme, {}, () => { oldDoneCalls++; });
  assert.equal(stale.render(80).length, 0);
  stale.handleInput?.('\r');
  lateReply({ label: 'late' });
  await assert.rejects(run(h, 'still-busy'), /already awaiting/);
  assert.equal(oldDoneCalls, 0);
  h.component.handleInput('\x1b[B');
  h.component.handleInput('\r');
  assert.equal((await next).details.answer, 'B');
  assert.deepEqual(phases(h), [['next', 'start'], ['next', 'end']]);
});

test('an opened TUI that throws cannot settle from stale keys after the guard is reused', async () => {
  const h = await questionHarness({ sessionId: 'session-a' });
  const custom = h.ctx.ui.custom;
  let stale, oldDoneCalls = 0;
  h.ctx.ui.custom = factory => {
    stale = factory({ requestRender() {} }, theme, {}, () => { oldDoneCalls++; });
    throw Error('opened TUI failed');
  };
  await assert.rejects(run(h, 'old'), /opened TUI failed/);
  h.ctx.ui.custom = custom;
  const next = run(h, 'next');
  stale.handleInput('\r');
  assert.equal(oldDoneCalls, 0);
  h.component.handleInput('\r');
  assert.equal((await next).details.answer, 'A');
  assert.deepEqual(phases(h), [['old', 'start'], ['old', 'end'], ['next', 'start'], ['next', 'end']]);
});

test('prepareArguments repairs only unambiguous JSON layers and keeps literal quoted text', async () => {
  const h = await questionHarness();
  const literal = { question: '"Choose"', header: '"Heading"', options: [{ label: '"A"', description: '{"example":1}' }] };
  for (const raw of [literal, JSON.stringify(literal), { ...literal, options: JSON.stringify(literal.options) }]) {
    const prepared = h.tool.prepareArguments(raw);
    assert.deepEqual(JSON.parse(JSON.stringify(prepared)), literal);
    const pending = run(h, 'literal', raw);
    h.component.handleInput('\r');
    assert.equal((await pending).details.answer, '"A"');
  }
});

test('malformed or repeatedly encoded arguments never open UI or produce an answer', async () => {
  const h = await questionHarness();
  for (const raw of ['{broken', JSON.stringify(JSON.stringify(params)), { ...params, options: '["A"]' },
    { ...params, options: JSON.stringify(JSON.stringify(params.options)) },
    JSON.stringify({ ...params, options: JSON.stringify(params.options) }), { ...params, multiSelect: 'yes' }]) {
    assert.throws(() => h.tool.prepareArguments(raw), /Invalid question arguments/);
    const result = await run(h, 'malformed', raw);
    assert.equal(result.isError, true);
    assert.equal(result.details.answer, null);
    assert.match(result.content[0].text, /Invalid question arguments/);
  }
  assert.equal(h.component, undefined);
  assert.deepEqual(h.events, []);
});

test('input line endings are normalized identically for TUI, RPC and result text', async () => {
  const h = await questionHarness({ sessionId: 'session-a' });
  const raw = { question: 'Q1\r\nQ2\rQ3', header: 'H1\rH2', options: [{ label: 'A1\r\nA2', description: 'D1\rD2' }] };
  const pending = run(h, 'tui', JSON.stringify(raw));
  const rendered = h.component.render(100);
  assert.ok(rendered.includes('H1') && rendered.includes('H2'));
  assert.ok(rendered.includes('Q1') && rendered.includes('Q2') && rendered.includes('Q3'));
  assert.match(rendered.join('\n'), /A1\n\s+A2\n\s+D1\n\s+D2/);
  assert.ok(rendered.every(line => !line.includes('\r')));
  h.component.handleInput('\r');
  const tui = await pending;
  assert.equal(tui.details.question, 'Q1\nQ2\nQ3');
  assert.equal(tui.details.answer, 'A1\nA2');
  const eventBytes = JSON.stringify(h.events);
  for (const text of ['H1', 'Q1', 'A1', 'D1']) assert.ok(!eventBytes.includes(text));

  const rpc = await run(h, 'rpc', { ...raw, options: JSON.stringify(raw.options) }, undefined, { ...h.ctx, mode: 'rpc', ui: {
    async select(title, menu) {
      assert.equal(title, 'H1\nH2\n\nQ1\nQ2\nQ3');
      assert.equal(menu[0], '1. A1\nA2 — D1\nD2');
      return menu[0];
    }, input: async () => undefined,
  } });
  assert.deepEqual(rpc, tui);
  assert.equal(JSON.stringify(h.events), eventBytes);
});

test('registration is model-only without changing public identity', async () => {
  const h = await questionHarness();
  assert.equal(h.tool.name, 'ask_user_question');
  assert.equal(h.tool.exposure, 'model-only');
});

test('long Chinese and emoji rows keep focus and both footer keys visible across resizes', async () => {
  const h = await questionHarness({ terminalRows: 16, terminalColumns: 26 });
  const long = '很长的描述中文🙂 '.repeat(80);
  const pending = run(h, 'short', { question: '选择一个方案', options: [
    { label: '中文🙂', description: long }, { label: '第二项', description: long },
  ] });
  const assertViewport = (focus) => {
    const lines = h.component.render(h.terminal.columns);
    assert.ok(lines.length <= h.terminal.rows);
    assert.ok(lines.every(line => visibleWidth(line) <= h.terminal.columns));
    assert.match(lines.find(line => line.startsWith('❯')) ?? '', focus);
    assert.match(lines.at(-1), /(?:Enter|↵).*Esc/);
  };
  assertViewport(/中文🙂/);
  h.terminal.rows = 8; h.terminal.columns = 16;
  h.component.handleInput('\x1b[B');
  assertViewport(/第二项/);
  h.component.handleInput('\x1b[B');
  h.component.handleInput('test');
  assertViewport(/test/);
  const pasted = '\n中文🙂'.repeat(15);
  h.component.handleInput('\x1b[200~' + pasted + '\x1b[201~');
  const lines = h.component.render(16);
  assert.ok(lines.length <= 8);
  assert.ok(lines.some(line => line.includes(CURSOR_MARKER)));
  h.component.handleInput('\r');
  const result = await pending;
  assert.equal(result.details.wasCustom, true);
  assert.equal(result.details.answer, 'test' + pasted);

  const chat = run(h, 'chat', params);
  h.component.handleInput('\x1b[A');
  assertViewport(/Chat/);
  h.component.handleInput('\r');
  assert.equal((await chat).details.wasChat, true);
});

test('RPC Other abort/cancel release the native guard without reusing a late input reply', async () => {
  const h = await questionHarness({ sessionId: 'session-a' });
  const ctx = { ...h.ctx, mode: 'rpc', ui: {
    select: async (_title, menu) => menu.find(item => item.startsWith('[Other]')),
    input: async () => undefined,
  } };
  const cancelled = await run(h, 'input-cancelled', params, undefined, ctx);
  assert.equal(cancelled.content[0].text, 'User declined to answer questions');
  assert.ok(!cancelled.isError);

  let lateReply, inputOpened;
  const opened = new Promise(resolve => { inputOpened = resolve; });
  ctx.ui.input = () => new Promise(resolve => { lateReply = resolve; inputOpened(); });
  const controller = new AbortController();
  const old = run(h, 'input-aborted', params, controller.signal, ctx);
  await opened;
  controller.abort();
  assert.equal((await old).content[0].text, 'Question cancelled');
  const next = run(h, 'tui-successor');
  lateReply('stale answer');
  await assert.rejects(run(h, 'still-busy'), /already awaiting/);
  h.component.handleInput('\r');
  assert.equal((await next).details.answer, 'A');
  assert.deepEqual(phases(h), [['tui-successor', 'start'], ['tui-successor', 'end']]);
});

test('TUI input callback failures close the dialog and release its session guard', async () => {
  const h = await questionHarness({ sessionId: 'session-a' });
  h.ctx.ui.notify = () => { throw Error('TUI notification failed'); };
  const failed = run(h, 'failed', { ...params, multiSelect: true });
  h.component.handleInput('\r');
  await assert.rejects(failed, /TUI notification failed/);
  assert.deepEqual(phases(h), [['failed', 'start'], ['failed', 'end']]);
  const next = run(h, 'next');
  h.component.handleInput('\r');
  assert.equal((await next).details.answer, 'A');
});
