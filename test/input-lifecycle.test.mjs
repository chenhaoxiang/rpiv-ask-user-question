import test from 'node:test';
import assert from 'node:assert/strict';
import { questionHarness } from './helpers/source-vm.mjs';

const params = { question: 'private-question-sentinel', options: [{ label: 'Keep' }] };

test('emits only opaque prompt lifecycle events around the real custom UI', async () => {
  const h = await questionHarness();
  const pending = h.tool.execute('call-1', params, undefined, undefined, h.ctx);
  assert.deepEqual(h.events, [{ name: 'pi:input-required', data: { version: 1, source: 'ask_user_question', id: 'call-1', phase: 'start' } }]);
  h.finish(null); await pending;
  assert.deepEqual(h.events, [
    { name: 'pi:input-required', data: { version: 1, source: 'ask_user_question', id: 'call-1', phase: 'start' } },
    { name: 'pi:input-required', data: { version: 1, source: 'ask_user_question', id: 'call-1', phase: 'end' } },
  ]);
  assert.ok(!JSON.stringify(h.events).includes('private-question-sentinel'));
});

test('invalid UI paths emit no prompt lifecycle event', async () => {
  const noUi = await questionHarness(); noUi.ctx.hasUI = false;
  await noUi.tool.execute('no-ui', params, undefined, undefined, noUi.ctx); assert.deepEqual(noUi.events, []);
  const empty = await questionHarness(); await empty.tool.execute('empty', { ...params, options: [] }, undefined, undefined, empty.ctx); assert.deepEqual(empty.events, []);
  const aborted = await questionHarness(); const controller = new AbortController(); controller.abort();
  await aborted.tool.execute('aborted', params, controller.signal, undefined, aborted.ctx); assert.deepEqual(aborted.events, []);
});

test('observer failures never change the question result and abort emits one end', async () => {
  const h = await questionHarness({ onEvent: () => { throw new Error('synthetic observer failure'); } });
  const controller = new AbortController();
  const pending = h.tool.execute('abort-1', params, controller.signal, undefined, h.ctx);
  controller.abort(); const result = await pending;
  assert.match(result.content[0].text, /Question cancelled/);
  assert.deepEqual(h.events.map(x => x.data.phase), ['start', 'end']);
});

test('host rejection before the component factory does not invent a UI interval', async () => {
  const h = await questionHarness(); h.ctx.ui.custom = () => { throw new Error('before factory'); };
  await assert.rejects(h.tool.execute('not-opened', params, undefined, undefined, h.ctx), /before factory/);
  assert.deepEqual(h.events, []);
});

test('UI failure still closes the opaque lifecycle event', async () => {
  const h = await questionHarness();
  h.ctx.ui.custom = factory => {
    factory({ requestRender() {} }, { fg: (_c, x) => x, bg: (_c, x) => x, bold: x => x, strikethrough: x => x }, {}, () => {});
    throw new Error('synthetic-ui-failure');
  };
  await assert.rejects(h.tool.execute('failure', params, undefined, undefined, h.ctx), /synthetic-ui-failure/);
  assert.deepEqual(h.events.map(x => x.data.phase), ['start', 'end']);
});
