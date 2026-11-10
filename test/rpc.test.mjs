import test from 'node:test';
import assert from 'node:assert/strict';
import { questionHarness } from './helpers/source-vm.mjs';

const params = { question: 'Choose', options: [{ label: 'A', description: 'first' }, { label: 'A', description: 'duplicate' }, { label: 'B' }] };
async function rpcHarness(answers = [], inputs = []) {
  const h = await questionHarness();
  h.ctx.mode = 'rpc';
  const dialogs = [];
  h.ctx.ui.select = async (title, options, opts) => {
    dialogs.push({ method: 'select', title, options, signal: opts?.signal });
    const next = answers.shift();
    return typeof next === 'function' ? next(options, opts) : next;
  };
  h.ctx.ui.input = async (title, placeholder, opts) => {
    dialogs.push({ method: 'input', title, signal: opts?.signal });
    return inputs.shift();
  };
  return { ...h, dialogs };
}
const option = index => options => options[index];
const action = label => options => options.find(value => value.includes(label));

test('RPC single selection preserves the original label despite duplicate display labels', async () => {
  const h = await rpcHarness([option(1)]);
  const r = await h.tool.execute('rpc-1', params, undefined, undefined, h.ctx);
  assert.equal(r.details.answer, 'A');
  assert.equal(r.details.wasCustom, false);
  assert.ok(!r.isError);
  assert.equal(h.dialogs[0].options.length, params.options.length + 2);
  assert.match(h.dialogs[0].options[1], /duplicate/);
  assert.equal(h.events.length, 0);
});

test('RPC Other and empty Other preserve the existing result contract', async () => {
  for (const text of ['custom 中文', '']) {
    const h = await rpcHarness([action('Type something.')], [text]);
    const r = await h.tool.execute('rpc-other', params, undefined, undefined, h.ctx);
    assert.equal(r.details.wasCustom, true);
    assert.equal(r.details.answer, text || null);
    assert.equal(h.dialogs[1].method, 'input');
  }
});

test('RPC Chat is not a made-up option answer and cancellation is not an error', async () => {
  const chat = await rpcHarness([action('Chat about this')]);
  const r = await chat.tool.execute('chat', params, undefined, undefined, chat.ctx);
  assert.equal(r.details.wasChat, true);
  const cancelled = await rpcHarness([undefined]);
  const noAnswer = await cancelled.tool.execute('cancel', params, undefined, undefined, cancelled.ctx);
  assert.equal(noAnswer.details.answer, null);
  assert.ok(!noAnswer.isError);
});

test('RPC multi-select preserves original order and distinct duplicate indices', async () => {
  const h = await rpcHarness([option(2), option(0), option(1), action('Submit checked')]);
  const r = await h.tool.execute('multi', { ...params, multiSelect: true }, undefined, undefined, h.ctx);
  assert.deepEqual([...r.details.answers], ['A', 'A', 'B']);
  assert.deepEqual([...r.details.selectedIndices], [0, 1, 2]);
  assert.equal(r.details.answer, 'A\nA\nB');
  assert.equal(r.details.multiSelect, true);
});

test('RPC empty multi-selection does not fabricate an answer; Other and Chat are exclusive', async () => {
  const h = await rpcHarness([action('Submit checked'), option(1), action('Type something.')], ['only custom']);
  const r = await h.tool.execute('empty', { ...params, multiSelect: true }, undefined, undefined, h.ctx);
  assert.equal(h.notices.length, 1);
  assert.equal(r.details.answer, 'only custom');
  assert.equal(r.details.answers, undefined);
  const chat = await rpcHarness([option(2), action('Chat about this')]);
  const cr = await chat.tool.execute('chat', { ...params, multiSelect: true }, undefined, undefined, chat.ctx);
  assert.equal(cr.details.wasChat, true);
  assert.equal(cr.details.answers, undefined);
});

test('RPC abort releases the concurrency guard and late UI results cannot answer the next call', async () => {
  let late;
  const h = await rpcHarness([() => new Promise(resolve => { late = resolve; })]);
  const a = new AbortController();
  const pending = h.tool.execute('old', params, a.signal, undefined, h.ctx);
  await Promise.resolve();
  await assert.rejects(h.tool.execute('overlap', params, undefined, undefined, h.ctx), /already awaiting/);
  a.abort();
  assert.equal((await pending).content[0].text, 'Question cancelled');
  let finishNew;
  h.ctx.ui.select = async (_title, options) => new Promise(resolve => { finishNew = () => resolve(options[2]); });
  let newSettled = false;
  const next = h.tool.execute('next', params, undefined, undefined, h.ctx).then(value => { newSettled = true; return value; });
  await Promise.resolve();
  late('old answer');
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(newSettled, false);
  finishNew();
  assert.equal((await next).details.answer, 'B');
});

test('RPC UI failures release the same guard; unavailable hosts remain structured errors', async () => {
  const h = await rpcHarness([() => { throw Error('disconnected host'); }]);
  await assert.rejects(h.tool.execute('fails', params, undefined, undefined, h.ctx), /disconnected/);
  h.ctx.ui.select = async (_title, options) => options[0];
  assert.equal((await h.tool.execute('retry', params, undefined, undefined, h.ctx)).details.answer, 'A');
  delete h.ctx.ui.select;
  const unavailable = await h.tool.execute('no-ui', params, undefined, undefined, h.ctx);
  assert.equal(unavailable.isError, true);
});
