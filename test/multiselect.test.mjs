import test from 'node:test';
import assert from 'node:assert/strict';
import { questionHarness, loadSource, theme } from './helpers/source-vm.mjs';
import { visibleWidth } from '@earendil-works/pi-tui';
const params = { question: '哪些？', multiSelect: true, options: [{ label: '相同' },{ label: 'B' },{ label: '相同' }] };
const plain = x => JSON.parse(JSON.stringify(x));
test('checked identities survive navigation, toggle and submit in input order', async () => {
  const h = await questionHarness(); const p = h.tool.execute('id',params,undefined,undefined,h.ctx);
  h.component.handleInput(' '); h.component.handleInput('\x1b[B'); h.component.handleInput(' ');
  h.component.handleInput(' '); h.component.handleInput('\x1b[B'); h.component.handleInput(' ');
  assert.match(h.component.render(80).join('\n'), /\[x\]/);
  h.component.handleInput('\r');
  const d = plain((await p).details);
  assert.deepEqual(d.answers,['相同','相同']); assert.deepEqual(d.selectedIndices,[0,2]); assert.equal(d.multiSelect,true);
});
test('empty selection stays open, without fabricating an answer', async () => {
  const h = await questionHarness(); const p = h.tool.execute('id',params,undefined,undefined,h.ctx);
  h.component.handleInput('\r'); assert.equal(h.notices.length,1);
  h.component.handleInput('\x1b'); assert.equal((await p).details.answer,null);
});
for (const kind of ['other','chat']) test(`multi selection ${kind} is exclusive`, async () => {
  const h = await questionHarness(); const p = h.tool.execute('id',params,undefined,undefined,h.ctx);
  h.component.handleInput(' ');
  for (let i=0;i<(kind==='other'?3:4);i++) h.component.handleInput('\x1b[B');
  if (kind==='other') { h.component.handleInput('hello world'); }
  h.component.handleInput('\r'); const d=(await p).details;
  assert.equal(d.answers,undefined); assert.equal(kind==='other'?d.wasCustom:d.wasChat,true);
  if(kind==='other') assert.equal(d.answer,'hello world');
});
test('already aborted skips UI; in-flight abort resolves and late keys cannot override it', async () => {
  const early=await questionHarness(); const a=new AbortController(); a.abort();
  assert.equal((await early.tool.execute('id',params,a.signal,undefined,early.ctx)).details.answer,null); assert.equal(early.component,undefined);
  const h=await questionHarness(); const b=new AbortController(); const p=h.tool.execute('id',params,b.signal,undefined,h.ctx);
  b.abort(); h.component.handleInput(' '); h.component.handleInput('\r'); assert.equal((await p).details.answer,null);
});
test('abort listener is removed after answer and after UI errors', async () => {
  for (const fail of [false,true]) {
    const h=await questionHarness(); const signal={aborted:false,adds:0,removes:0,addEventListener(){this.adds++},removeEventListener(){this.removes++}};
    if(fail) h.ctx.ui.custom=f=>{f({requestRender(){}},theme,{},()=>{});throw new Error('synthetic UI failure')};
    const p=h.tool.execute('id',params,signal,undefined,h.ctx);
    if(fail) await assert.rejects(p,/synthetic UI/); else {h.component.handleInput(' ');h.component.handleInput('\r');await p;}
    assert.equal(signal.adds,1); assert.equal(signal.removes,1);
  }
});
test('selector wrapping fits narrow, Chinese, emoji and changing widths', async () => {
  const api=await loadSource(new URL('../wrapping-select.ts',import.meta.url));
  const select=new api.WrappingSelect([{label:'很长的中文问题🙂 '.repeat(12),description:'说明 '.repeat(30)},{label:'Other',isOther:true}],2,{selectedText:x=>x,description:x=>x,scrollInfo:x=>x});
  select.setCheckedIndices(new Set([0]));
  for(const width of [1,3,8,20,80]) for(const line of select.render(width)) assert.ok(visibleWidth(line)<=width);
  select.setSelectedIndex(1); select.setInputBuffer('测试🙂 多行\n粘贴',2);
  for(const line of select.render(12)) assert.ok(visibleWidth(line)<=12);
});
