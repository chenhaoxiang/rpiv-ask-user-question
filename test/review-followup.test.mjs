import test from 'node:test';
import assert from 'node:assert/strict';
import { questionHarness } from './helpers/source-vm.mjs';
const params={question:'Choose',multiSelect:true,options:[{label:'A'},{label:'B'}]};
for(const mode of ['rpc','json','print'])test(`hasUI cannot make ${mode} a custom terminal`,async()=>{
 const h=await questionHarness();h.ctx.mode=mode;
 const r=await h.tool.execute('id',params,undefined,undefined,h.ctx);
 assert.match(r.content[0].text,/UI not available/);assert.equal(h.component,undefined);
});
test('text answer and zero-based positions agree with checked choices',async()=>{
 const h=await questionHarness();const p=h.tool.execute('id',params,undefined,undefined,h.ctx);
 h.component.handleInput(' ');h.component.handleInput('\x1b[B');h.component.handleInput(' ');h.component.handleInput('\r');
 const d=(await p).details;assert.equal(d.answer,'A\nB');assert.deepEqual([...d.selectedIndices],[0,1]);
});
test('in-flight abort is cancellation, not user refusal',async()=>{
 const h=await questionHarness();const a=new AbortController();const p=h.tool.execute('id',params,a.signal,undefined,h.ctx);
 a.abort();assert.equal((await p).content[0].text,'Question cancelled');
});
