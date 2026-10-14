import test from 'node:test';
import assert from 'node:assert/strict';
import { questionHarness } from './helpers/source-vm.mjs';
const params = { question: '选择？', options: [{ label: 'A' }, { label: 'B' }] };
const normalize = x => JSON.parse(JSON.stringify(x));
for (const [name, keys, expected] of [
  ['single', ['\r'], { question: '选择？', answer: 'A', wasCustom: false }],
  ['cancel', ['\x1b'], { question: '选择？', answer: null }],
  ['custom editable', ['\x1b[B','\x1b[B','abc','\x7f','\r'], { question: '选择？', answer: 'ab', wasCustom: true }],
  ['chat', ['\x1b[A','\r'], { question: '选择？', answer: 'User wants to chat about this', wasChat: true }],
]) test(`baseline ${name}`, async () => {
  const h = await questionHarness(); const promise = h.tool.execute('id',params,undefined,undefined,h.ctx);
  for (const key of keys) h.component.handleInput(key);
  assert.deepEqual(normalize((await promise).details), expected);
});
test('baseline unavailable UI and empty options do not open custom dialog', async () => {
  const h = await questionHarness(); h.ctx.hasUI = false;
  assert.match((await h.tool.execute('id',params,undefined,undefined,h.ctx)).content[0].text, /UI not available/);
  h.ctx.hasUI = true;
  assert.match((await h.tool.execute('id',{...params,options:[]},undefined,undefined,h.ctx)).content[0].text, /No options/);
  assert.equal(h.component, undefined);
});
